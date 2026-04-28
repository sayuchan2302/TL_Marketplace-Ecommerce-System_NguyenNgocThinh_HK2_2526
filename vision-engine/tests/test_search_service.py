from __future__ import annotations

from contextlib import nullcontext
from io import BytesIO
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from uuid import uuid4

from PIL import Image, ImageDraw


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.search_service import (  # noqa: E402
    ImageSearchService,
    SearchValidationError,
    apply_candidate_thresholds,
    build_query_views,
    decode_search_image,
    group_search_candidates,
    validate_image_upload,
)


class SearchServiceLogicTests(unittest.TestCase):
    class _FakeCursor:
        def __init__(self, rows):
            self._rows = rows
            self.executed_sql = ""
            self.executed_params = []

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            return False

        def execute(self, sql, params):
            self.executed_sql = sql
            self.executed_params = params

        def fetchall(self):
            return self._rows

    class _FakeConnection:
        def __init__(self, cursor):
            self._cursor = cursor

        def cursor(self):
            return self._cursor

    @staticmethod
    def _build_jpeg_payload(*, size: tuple[int, int] = (6, 6), color: str = "red") -> bytes:
        image = Image.new("RGB", size, color=color)
        buffer = BytesIO()
        image.save(buffer, format="JPEG")
        return buffer.getvalue()

    def test_validate_image_upload_rejects_non_image_content_type(self) -> None:
        with self.assertRaises(SearchValidationError) as context:
            validate_image_upload("application/pdf", b"fake")

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.metrics_status, "invalid_content_type")

    def test_validate_image_upload_accepts_valid_jpeg_with_image_content_type(self) -> None:
        validate_image_upload("image/jpeg", self._build_jpeg_payload())

    def test_validate_image_upload_rejects_empty_payload(self) -> None:
        with self.assertRaises(SearchValidationError) as context:
            validate_image_upload("image/png", b"")

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.metrics_status, "empty_payload")

    def test_validate_image_upload_rejects_oversized_payload(self) -> None:
        with patch("app.search_service.settings.max_upload_size_bytes", 4):
            with self.assertRaises(SearchValidationError) as context:
                validate_image_upload("image/png", b"12345")

        self.assertEqual(context.exception.status_code, 413)
        self.assertEqual(context.exception.metrics_status, "oversized_payload")

    def test_validate_image_upload_accepts_valid_jpeg_with_octet_stream(self) -> None:
        validate_image_upload("application/octet-stream", self._build_jpeg_payload())

    def test_validate_image_upload_accepts_valid_jpeg_with_missing_or_blank_content_type(self) -> None:
        payload = self._build_jpeg_payload()

        validate_image_upload(None, payload)
        validate_image_upload("   ", payload)

    def test_validate_image_upload_rejects_text_plain_content_type(self) -> None:
        with self.assertRaises(SearchValidationError) as context:
            validate_image_upload("text/plain", b"hello world")

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.metrics_status, "invalid_content_type")

    def test_decode_search_image_rejects_invalid_bytes(self) -> None:
        with self.assertRaises(SearchValidationError) as context:
            decode_search_image(b"not-an-image")

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.metrics_status, "decode_error")

    def test_decode_search_image_accepts_real_image_bytes(self) -> None:
        image = Image.new("RGB", (4, 4), color="red")
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        payload = buffer.getvalue()

        decoded = decode_search_image(payload)

        self.assertEqual(decoded.size, (4, 4))

    def test_decode_search_image_normalizes_exif_orientation(self) -> None:
        image = Image.new("RGB", (12, 24), color="blue")
        exif = Image.Exif()
        exif[274] = 6
        buffer = BytesIO()
        image.save(buffer, format="JPEG", exif=exif)

        decoded = decode_search_image(buffer.getvalue())

        self.assertEqual(decoded.size, (24, 12))

    def test_decode_search_image_accepts_valid_octet_stream_payload(self) -> None:
        payload = self._build_jpeg_payload(color="yellow")
        validate_image_upload("application/octet-stream", payload)

        decoded = decode_search_image(payload)

        self.assertEqual(decoded.mode, "RGB")

    def test_validate_image_upload_rejects_text_payload_when_octet_stream(self) -> None:
        with self.assertRaises(SearchValidationError) as context:
            validate_image_upload("application/octet-stream", b"hello world")

        self.assertEqual(context.exception.status_code, 400)
        self.assertEqual(context.exception.metrics_status, "decode_error")

    def test_group_search_candidates_prefers_higher_ranking_score(self) -> None:
        product_id = uuid4()
        rows = [
            {
                "backend_product_id": product_id,
                "image_url": "https://example.com/a.jpg",
                "image_index": 2,
                "is_primary": False,
                "category_slug": "men",
                "available_stock": 0,
                "score": 0.82,
            },
            {
                "backend_product_id": product_id,
                "image_url": "https://example.com/b.jpg",
                "image_index": 1,
                "is_primary": True,
                "category_slug": "men",
                "available_stock": 3,
                "score": 0.81,
            },
        ]

        grouped = group_search_candidates(rows)

        self.assertEqual(len(grouped), 1)
        self.assertEqual(grouped[0].candidate.matched_image_url, "https://example.com/b.jpg")
        self.assertTrue(grouped[0].candidate.is_primary)

    def test_group_search_candidates_applies_soft_category_boost(self) -> None:
        product_a = uuid4()
        product_b = uuid4()
        rows = [
            {
                "backend_product_id": product_a,
                "image_url": "https://example.com/a.jpg",
                "image_index": 0,
                "is_primary": False,
                "category_slug": "women",
                "available_stock": 0,
                "score": 0.82,
            },
            {
                "backend_product_id": product_b,
                "image_url": "https://example.com/b.jpg",
                "image_index": 0,
                "is_primary": True,
                "category_slug": "men",
                "available_stock": 5,
                "score": 0.78,
            },
        ]

        grouped = group_search_candidates(
            rows,
            category_slug="men",
            apply_soft_category_boost=True,
        )
        candidates, _, _, status, _, _ = apply_candidate_thresholds(grouped)

        self.assertEqual(status, "accepted")
        self.assertEqual(candidates[0].backend_product_id, product_b)

    def test_apply_candidate_thresholds_breaks_ties_by_backend_product_id(self) -> None:
        lower_product_id = uuid4()
        higher_product_id = uuid4()
        if str(lower_product_id) > str(higher_product_id):
            lower_product_id, higher_product_id = higher_product_id, lower_product_id

        grouped = group_search_candidates(
            [
                {
                    "backend_product_id": higher_product_id,
                    "image_url": "https://example.com/b.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 1,
                    "score": 0.88,
                },
                {
                    "backend_product_id": lower_product_id,
                    "image_url": "https://example.com/a.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 1,
                    "score": 0.88,
                },
            ]
        )

        candidates, _, _, status, _, _ = apply_candidate_thresholds(grouped)

        self.assertEqual(status, "accepted")
        self.assertEqual(candidates[0].backend_product_id, lower_product_id)
        self.assertEqual(candidates[1].backend_product_id, higher_product_id)

    def test_apply_candidate_thresholds_returns_low_confidence_when_top_score_is_too_low(self) -> None:
        grouped = group_search_candidates(
            [
                {
                    "backend_product_id": uuid4(),
                    "image_url": "https://example.com/a.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 2,
                    "score": 0.5,
                }
            ]
        )

        candidates, top_score, score_floor, status, empty_reason, threshold_filtered_count = apply_candidate_thresholds(grouped)

        self.assertEqual(candidates, [])
        self.assertEqual(status, "low_confidence")
        self.assertEqual(empty_reason, "top_score_below_min_confidence")
        self.assertEqual(top_score, 0.5)
        self.assertIsNotNone(score_floor)
        self.assertEqual(threshold_filtered_count, 1)

    def test_apply_candidate_thresholds_filters_tail_candidates(self) -> None:
        grouped = group_search_candidates(
            [
                {
                    "backend_product_id": uuid4(),
                    "image_url": "https://example.com/a.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 3,
                    "score": 0.9,
                },
                {
                    "backend_product_id": uuid4(),
                    "image_url": "https://example.com/b.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 1,
                    "score": 0.7,
                },
                {
                    "backend_product_id": uuid4(),
                    "image_url": "https://example.com/c.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 0,
                    "score": 0.5,
                },
            ]
        )

        candidates, top_score, score_floor, status, empty_reason, threshold_filtered_count = apply_candidate_thresholds(grouped)

        self.assertEqual(status, "accepted")
        self.assertIsNone(empty_reason)
        self.assertEqual(top_score, 0.9)
        self.assertAlmostEqual(score_floor or 0.0, 0.63, places=2)
        self.assertEqual(len(candidates), 2)
        self.assertEqual(threshold_filtered_count, 1)

    def test_query_similar_images_applies_category_store_filters(self) -> None:
        fake_cursor = self._FakeCursor(
            [
                (uuid4(), "https://example.com/a.jpg", 0, True, "men", 5, 0.91),
            ]
        )
        service = ImageSearchService(clip_service=object())  # type: ignore[arg-type]

        with patch("app.search_service.get_connection", return_value=nullcontext(self._FakeConnection(fake_cursor))):
            rows = service._query_similar_images(
                vector=[0.1, 0.2],
                ann_limit=10,
                category_slug="men",
                store_slug="vision-store",
            )

        self.assertEqual(len(rows), 1)
        self.assertIn("category_slug = %s", fake_cursor.executed_sql)
        self.assertIn("store_slug = %s", fake_cursor.executed_sql)
        self.assertEqual(fake_cursor.executed_params[1], "men")
        self.assertEqual(fake_cursor.executed_params[2], "vision-store")

    def test_query_similar_images_skips_scope_filters_when_empty(self) -> None:
        fake_cursor = self._FakeCursor([])
        service = ImageSearchService(clip_service=object())  # type: ignore[arg-type]

        with patch("app.search_service.get_connection", return_value=nullcontext(self._FakeConnection(fake_cursor))):
            service._query_similar_images(
                vector=[0.3, 0.4],
                ann_limit=6,
                category_slug=None,
                store_slug=None,
            )

        self.assertNotIn("category_slug = %s", fake_cursor.executed_sql)
        self.assertNotIn("store_slug = %s", fake_cursor.executed_sql)
        self.assertEqual(len(fake_cursor.executed_params), 3)

    def test_build_query_views_adds_foreground_and_center_views(self) -> None:
        image = Image.new("RGB", (100, 100), color="white")
        drawer = ImageDraw.Draw(image)
        drawer.rectangle([38, 12, 62, 88], fill="black")

        views = build_query_views(image)
        names = [view.name for view in views]

        self.assertIn("foreground", names)
        self.assertIn("center", names)
        self.assertIn("original", names)

    def test_query_similar_images_with_views_prefers_foreground_consensus(self) -> None:
        service = ImageSearchService(clip_service=object())  # type: ignore[arg-type]

        product_a = uuid4()
        product_b = uuid4()

        responses = [
            [
                {
                    "backend_product_id": product_a,
                    "image_url": "https://example.com/a.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 3,
                    "score": 0.62,
                },
                {
                    "backend_product_id": product_b,
                    "image_url": "https://example.com/b.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 3,
                    "score": 0.81,
                },
            ],
            [
                {
                    "backend_product_id": product_a,
                    "image_url": "https://example.com/a.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 3,
                    "score": 0.87,
                },
            ],
            [
                {
                    "backend_product_id": product_a,
                    "image_url": "https://example.com/a.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 3,
                    "score": 0.79,
                },
                {
                    "backend_product_id": product_b,
                    "image_url": "https://example.com/b.jpg",
                    "image_index": 0,
                    "is_primary": True,
                    "category_slug": "men",
                    "available_stock": 3,
                    "score": 0.7,
                },
            ],
        ]
        call_index = {"value": 0}

        def fake_query(vector, ann_limit, category_slug, store_slug):
            index = call_index["value"]
            call_index["value"] += 1
            return responses[index]

        service._query_similar_images = fake_query  # type: ignore[method-assign]

        ranked, db_query_latency_ms = service._query_similar_images_with_views(
            vectors=[[0.1], [0.2], [0.3]],
            view_names=["foreground", "center", "original"],
            limit=10,
            category_slug=None,
            store_slug=None,
        )

        self.assertGreaterEqual(len(ranked), 2)
        self.assertEqual(ranked[0]["backend_product_id"], product_a)
        self.assertGreaterEqual(db_query_latency_ms, 0.0)


if __name__ == "__main__":
    unittest.main()
