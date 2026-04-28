from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
from io import BytesIO
from threading import Lock
from time import perf_counter
from typing import Any

import numpy as np
from PIL import Image, ImageOps

from .config import settings
from .db import get_connection
from .models import SearchCandidate
from .openclip_service import OpenClipService


Image.MAX_IMAGE_PIXELS = max(1, settings.max_image_pixels)
GENERIC_BINARY_CONTENT_TYPES = {"", "application/octet-stream"}


class SearchValidationError(Exception):
    def __init__(self, status_code: int, detail: str, metrics_status: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail
        self.metrics_status = metrics_status


@dataclass(slots=True)
class SearchExecutionResult:
    candidates: list[SearchCandidate]
    grouped_candidate_count: int
    threshold_filtered_count: int
    top_score: float | None
    score_floor: float | None
    status: str
    empty_reason: str | None
    index_version: str
    search_latency_ms: float
    encode_latency_ms: float
    db_query_latency_ms: float


@dataclass(frozen=True, slots=True)
class QueryView:
    name: str
    image: Image.Image


@dataclass(frozen=True, slots=True)
class RankedSearchCandidate:
    candidate: SearchCandidate
    ranking_score: float


def validate_image_upload(content_type: str | None, payload: bytes) -> None:
    if not payload:
        raise SearchValidationError(400, "Image file is required", "empty_payload")
    if len(payload) > settings.max_upload_size_bytes:
        raise SearchValidationError(413, "Image file is too large", "oversized_payload")
    normalized_content_type = (content_type or "").strip().lower()
    if normalized_content_type.startswith("image/"):
        return
    if normalized_content_type in GENERIC_BINARY_CONTENT_TYPES:
        try:
            with Image.open(BytesIO(payload)) as probe:
                probe.verify()
        except Image.DecompressionBombError as exc:
            raise SearchValidationError(413, "Image dimensions are too large", "oversized_payload") from exc
        except Exception as exc:  # noqa: BLE001
            raise SearchValidationError(400, "Unable to decode image", "decode_error") from exc
        return
    raise SearchValidationError(400, "Uploaded file must be an image", "invalid_content_type")


def decode_search_image(payload: bytes) -> Image.Image:
    try:
        with Image.open(BytesIO(payload)) as probe:
            probe.verify()

        with Image.open(BytesIO(payload)) as source:
            normalized = ImageOps.exif_transpose(source)
            if normalized.width * normalized.height > settings.max_image_pixels:
                raise SearchValidationError(413, "Image dimensions are too large", "oversized_payload")
            normalized.load()
            return normalized.convert("RGB")
    except SearchValidationError:
        raise
    except Image.DecompressionBombError as exc:
        raise SearchValidationError(413, "Image dimensions are too large", "oversized_payload") from exc
    except Exception as exc:  # noqa: BLE001
        raise SearchValidationError(400, "Unable to decode image", "decode_error") from exc


def _normalize_slug(value: str | None) -> str | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    return normalized or None


def _build_product_ranking_score(
    row: dict[str, Any],
    *,
    category_slug: str | None,
    apply_soft_category_boost: bool,
) -> float:
    ranking_score = float(row["score"]) * settings.image_search_product_best_image_weight

    if bool(row["is_primary"]):
        ranking_score += settings.image_search_product_primary_image_boost

    if int(row.get("available_stock") or 0) > 0:
        ranking_score += settings.image_search_product_in_stock_boost

    if apply_soft_category_boost:
        row_category_slug = _normalize_slug(str(row.get("category_slug") or ""))
        if row_category_slug and row_category_slug == category_slug:
            ranking_score += settings.image_search_product_category_match_boost

    return ranking_score


def _is_better_ranked_candidate(left: RankedSearchCandidate, right: RankedSearchCandidate) -> bool:
    if left.ranking_score != right.ranking_score:
        return left.ranking_score > right.ranking_score
    if left.candidate.score != right.candidate.score:
        return left.candidate.score > right.candidate.score
    if left.candidate.is_primary != right.candidate.is_primary:
        return left.candidate.is_primary
    if left.candidate.matched_image_index != right.candidate.matched_image_index:
        return left.candidate.matched_image_index < right.candidate.matched_image_index
    return str(left.candidate.backend_product_id) < str(right.candidate.backend_product_id)


def group_search_candidates(
    rows: list[dict[str, Any]],
    *,
    category_slug: str | None = None,
    apply_soft_category_boost: bool = False,
) -> list[RankedSearchCandidate]:
    normalized_category_slug = _normalize_slug(category_slug)
    grouped: OrderedDict[str, RankedSearchCandidate] = OrderedDict()
    for row in rows:
        ranking_score = _build_product_ranking_score(
            row,
            category_slug=normalized_category_slug,
            apply_soft_category_boost=apply_soft_category_boost,
        )
        candidate = SearchCandidate(
            backend_product_id=row["backend_product_id"],
            score=float(row["score"]),
            matched_image_url=row["image_url"],
            matched_image_index=int(row["image_index"] or 0),
            is_primary=bool(row["is_primary"]),
        )
        ranked_candidate = RankedSearchCandidate(candidate=candidate, ranking_score=ranking_score)
        key = str(row["backend_product_id"])
        existing = grouped.get(key)
        if existing is None or _is_better_ranked_candidate(ranked_candidate, existing):
            grouped[key] = ranked_candidate
    return list(grouped.values())


def apply_candidate_thresholds(
    candidates: list[RankedSearchCandidate],
) -> tuple[list[SearchCandidate], float | None, float | None, str, str | None, int]:
    if not candidates:
        return [], None, None, "empty", "no_similar_images", 0

    top_score = max(item.candidate.score for item in candidates)
    score_floor = min(
        top_score,
        max(
            settings.image_search_absolute_score_floor,
            top_score * settings.image_search_relative_score_floor,
        ),
    )
    threshold_filtered_count = len(candidates)

    if top_score < settings.image_search_min_confidence_score:
        return [], top_score, score_floor, "low_confidence", "top_score_below_min_confidence", threshold_filtered_count

    filtered = [item for item in candidates if item.candidate.score >= score_floor]
    threshold_filtered_count = max(0, len(candidates) - len(filtered))
    if not filtered:
        return [], top_score, score_floor, "empty", "all_candidates_below_score_floor", threshold_filtered_count

    ranked = sorted(
        filtered,
        key=lambda item: (
            -item.ranking_score,
            -item.candidate.score,
            not item.candidate.is_primary,
            item.candidate.matched_image_index,
            str(item.candidate.backend_product_id),
        ),
    )
    return [item.candidate for item in ranked], top_score, score_floor, "accepted", None, threshold_filtered_count


def format_score(value: float | None) -> str:
    if value is None:
        return "-"
    return f"{value:.4f}"


def extract_foreground_crop(image: Image.Image) -> Image.Image | None:
    rgb = image.convert("RGB")
    rows = np.asarray(rgb, dtype=np.int16)
    if rows.ndim != 3 or rows.shape[2] != 3:
        return None

    height, width, _ = rows.shape
    if height < 16 or width < 16:
        return None

    border = np.concatenate(
        (
            rows[0, :, :],
            rows[-1, :, :],
            rows[:, 0, :],
            rows[:, -1, :],
        ),
        axis=0,
    )
    bg_color = np.median(border, axis=0)
    diff = np.max(np.abs(rows - bg_color), axis=2)
    mask = diff >= 18
    if not np.any(mask):
        return None

    ys, xs = np.where(mask)
    y_min, y_max = int(ys.min()), int(ys.max())
    x_min, x_max = int(xs.min()), int(xs.max())
    box_width = x_max - x_min + 1
    box_height = y_max - y_min + 1
    area_ratio = (box_width * box_height) / float(max(1, width * height))
    if area_ratio < 0.03 or area_ratio > 0.98:
        return None

    padding = max(2, int(min(width, height) * 0.05))
    x0 = max(0, x_min - padding)
    y0 = max(0, y_min - padding)
    x1 = min(width, x_max + padding + 1)
    y1 = min(height, y_max + padding + 1)
    if x1 - x0 < 8 or y1 - y0 < 8:
        return None

    return rgb.crop((x0, y0, x1, y1))


def center_crop(image: Image.Image, ratio: float = 0.82) -> Image.Image | None:
    rgb = image.convert("RGB")
    width, height = rgb.size
    if width < 16 or height < 16:
        return None

    crop_width = max(8, int(width * ratio))
    crop_height = max(8, int(height * ratio))
    if crop_width >= width and crop_height >= height:
        return None

    left = max(0, (width - crop_width) // 2)
    top = max(0, (height - crop_height) // 2)
    right = min(width, left + crop_width)
    bottom = min(height, top + crop_height)
    if right - left < 8 or bottom - top < 8:
        return None
    return rgb.crop((left, top, right, bottom))


def build_query_views(image: Image.Image) -> list[QueryView]:
    original = image.convert("RGB")
    views: list[QueryView] = [QueryView(name="original", image=original)]

    foreground = extract_foreground_crop(original)
    if foreground is not None:
        views.insert(0, QueryView(name="foreground", image=foreground))

    cropped = center_crop(original)
    if cropped is not None:
        views.append(QueryView(name="center", image=cropped))

    return views


class ImageSearchService:
    def __init__(self, clip_service: OpenClipService) -> None:
        self.clip_service = clip_service
        self._index_info_lock = Lock()
        self._cached_index_info = {
            "active_image_count": 0,
            "active_product_count": 0,
            "index_version": "empty",
        }

    def search_bytes(
        self,
        *,
        content_type: str | None,
        payload: bytes,
        limit: int,
        category_slug: str | None,
        store_slug: str | None,
    ) -> SearchExecutionResult:
        search_started_at = perf_counter()
        validate_image_upload(content_type, payload)
        image = decode_search_image(payload)
        query_views = build_query_views(image)

        encode_started_at = perf_counter()
        vectors = self.clip_service.encode_images([view.image for view in query_views])
        encode_latency_ms = (perf_counter() - encode_started_at) * 1000

        rows, db_query_latency_ms = self._query_similar_images_with_views(
            vectors=vectors,
            view_names=[view.name for view in query_views],
            limit=limit,
            category_slug=category_slug,
            store_slug=store_slug,
        )
        apply_soft_category_boost = self._should_apply_soft_category_boost(category_slug)
        grouped_candidates = group_search_candidates(
            rows,
            category_slug=category_slug,
            apply_soft_category_boost=apply_soft_category_boost,
        )
        candidates, top_score, score_floor, status, empty_reason, threshold_filtered_count = apply_candidate_thresholds(
            grouped_candidates,
        )
        search_latency_ms = (perf_counter() - search_started_at) * 1000
        index_info = self.load_index_info()
        return SearchExecutionResult(
            candidates=candidates[:limit],
            grouped_candidate_count=len(grouped_candidates),
            threshold_filtered_count=threshold_filtered_count,
            top_score=top_score,
            score_floor=score_floor,
            status=status,
            empty_reason=empty_reason,
            index_version=str(index_info["index_version"]),
            search_latency_ms=search_latency_ms,
            encode_latency_ms=encode_latency_ms,
            db_query_latency_ms=db_query_latency_ms,
        )

    def load_index_info(self, *, force_refresh: bool = False) -> dict[str, int | str | None]:
        if not force_refresh:
            with self._index_info_lock:
                return dict(self._cached_index_info)

        sql = """
            SELECT
                COUNT(*) FILTER (WHERE is_active = true) AS active_image_count,
                COUNT(DISTINCT backend_product_id) FILTER (WHERE is_active = true) AS active_product_count,
                (
                    SELECT sync_token
                    FROM vision.product_image_embeddings
                    WHERE is_active = true
                    ORDER BY updated_at DESC
                    LIMIT 1
                ) AS index_version
            FROM vision.product_image_embeddings
        """
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(sql)
                row = cur.fetchone()

        info = {
            "active_image_count": int(row[0] or 0),
            "active_product_count": int(row[1] or 0),
            "index_version": row[2] or "empty",
        }
        with self._index_info_lock:
            self._cached_index_info = dict(info)
        return info

    def refresh_index_info(self) -> dict[str, int | str | None]:
        return self.load_index_info(force_refresh=True)

    def _resolve_query_view_weights(self, view_names: list[str]) -> dict[str, float]:
        if not view_names:
            return {}

        base_weights = {
            "foreground": settings.image_search_foreground_view_weight,
            "center": settings.image_search_center_view_weight,
            "original": settings.image_search_original_view_weight,
        }
        active_total = sum(base_weights.get(name, 0.0) for name in view_names)
        if active_total <= 0:
            uniform = 1.0 / len(view_names)
            return {name: uniform for name in view_names}
        return {name: base_weights.get(name, 0.0) / active_total for name in view_names}

    def _should_apply_soft_category_boost(self, category_slug: str | None) -> bool:
        return _normalize_slug(category_slug) is not None and settings.image_search_category_filter_mode.lower() == "soft"

    def _query_similar_images_with_views(
        self,
        *,
        vectors: list[Any],
        view_names: list[str],
        limit: int,
        category_slug: str | None,
        store_slug: str | None,
    ) -> tuple[list[dict[str, Any]], float]:
        if not vectors:
            return [], 0.0

        ann_limit = min(max(limit * settings.search_candidate_multiplier, limit), settings.search_candidate_cap)
        weights = self._resolve_query_view_weights(view_names)
        query_category_slug = None if self._should_apply_soft_category_boost(category_slug) else category_slug
        merged: OrderedDict[tuple[str, str, int, bool], dict[str, Any]] = OrderedDict()
        db_query_latency_ms = 0.0

        for vector, view_name in zip(vectors, view_names, strict=True):
            query_started_at = perf_counter()
            rows = self._query_similar_images(vector, ann_limit, query_category_slug, store_slug)
            db_query_latency_ms += (perf_counter() - query_started_at) * 1000
            weight = weights.get(view_name, 0.0)
            for row in rows:
                key = (
                    str(row["backend_product_id"]),
                    str(row["image_url"]),
                    int(row["image_index"] or 0),
                    bool(row["is_primary"]),
                )
                entry = merged.get(key)
                if entry is None:
                    entry = {
                        "backend_product_id": row["backend_product_id"],
                        "image_url": row["image_url"],
                        "image_index": int(row["image_index"] or 0),
                        "is_primary": bool(row["is_primary"]),
                        "category_slug": row.get("category_slug"),
                        "available_stock": int(row.get("available_stock") or 0),
                        "weighted_score": 0.0,
                        "best_score": 0.0,
                    }
                    merged[key] = entry

                score = float(row["score"])
                entry["weighted_score"] += score * weight
                if score > entry["best_score"]:
                    entry["best_score"] = score

        scored_rows: list[dict[str, Any]] = []
        for entry in merged.values():
            blended_score = entry["weighted_score"] + settings.image_search_best_view_bonus * entry["best_score"]
            scored_rows.append(
                {
                    "backend_product_id": entry["backend_product_id"],
                    "image_url": entry["image_url"],
                    "image_index": entry["image_index"],
                    "is_primary": entry["is_primary"],
                    "category_slug": entry["category_slug"],
                    "available_stock": entry["available_stock"],
                    "score": blended_score,
                }
            )

        scored_rows.sort(
            key=lambda item: (
                -float(item["score"]),
                not bool(item["is_primary"]),
                int(item["image_index"]),
                str(item["backend_product_id"]),
            ),
        )
        return scored_rows[:ann_limit], db_query_latency_ms

    def _query_similar_images(
        self,
        vector,
        ann_limit: int,
        category_slug: str | None,
        store_slug: str | None,
    ) -> list[dict[str, Any]]:
        filters = ["is_active = true"]
        params: list[Any] = []

        if category_slug:
            filters.append("category_slug = %s")
            params.append(category_slug)
        if store_slug:
            filters.append("store_slug = %s")
            params.append(store_slug)

        where_sql = " AND ".join(filters)
        sql = f"""
            SELECT
                backend_product_id,
                image_url,
                image_index,
                is_primary,
                category_slug,
                available_stock,
                1 - (embedding <=> %s) AS score
            FROM vision.product_image_embeddings
            WHERE {where_sql}
            ORDER BY embedding <=> %s
            LIMIT %s
        """

        with get_connection() as conn:
            with conn.cursor() as cur:
                if settings.search_hnsw_ef_search > 0:
                    cur.execute("SET LOCAL hnsw.ef_search = %s", (settings.search_hnsw_ef_search,))
                cur.execute(sql, [vector, *params, vector, ann_limit])
                rows = cur.fetchall()

        return [
            {
                "backend_product_id": row[0],
                "image_url": row[1],
                "image_index": row[2],
                "is_primary": row[3],
                "category_slug": row[4],
                "available_stock": row[5],
                "score": row[6],
            }
            for row in rows
        ]
