from __future__ import annotations

import logging

from fastapi import FastAPI, File, Header, HTTPException, Query, UploadFile

from .catalog_sync import CatalogSyncInProgressError, CatalogSyncService
from .config import settings
from .db import bootstrap_database, close_database_pool, get_connection, initialize_database_pool
from .models import IndexInfoResponse, SearchMetricsResponse, SearchResponse, SyncCatalogResponse
from .openclip_service import OpenClipService
from .search_metrics import SearchMetricsCollector
from .search_service import ImageSearchService, SearchValidationError, format_score


app = FastAPI(title=settings.app_name)
clip_service: OpenClipService | None = None
catalog_sync_service: CatalogSyncService | None = None
image_search_service: ImageSearchService | None = None
logger = logging.getLogger("uvicorn.error")
search_metrics = SearchMetricsCollector()


@app.on_event("startup")
def startup_event() -> None:
    global clip_service, catalog_sync_service, image_search_service
    bootstrap_database()
    initialize_database_pool()
    clip_service = OpenClipService()
    catalog_sync_service = CatalogSyncService(clip_service)
    image_search_service = ImageSearchService(clip_service)
    image_search_service.refresh_index_info()


@app.on_event("shutdown")
def shutdown_event() -> None:
    if catalog_sync_service is not None:
        catalog_sync_service.close()
    close_database_pool()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, bool]:
    if clip_service is None:
        return {"ready": False}
    try:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
    except Exception:  # noqa: BLE001
        return {"ready": False}
    return {"ready": True}


@app.get("/v1/index/info", response_model=IndexInfoResponse)
def index_info() -> IndexInfoResponse:
    if image_search_service is None:
        info = {"active_image_count": 0, "active_product_count": 0, "index_version": "empty"}
    else:
        info = image_search_service.load_index_info(force_refresh=True)
    return IndexInfoResponse(
        ready=clip_service is not None,
        model_name=settings.openclip_model_name,
        model_pretrained=settings.openclip_pretrained,
        embedding_dimension=settings.embedding_dimension,
        active_image_count=info["active_image_count"],
        active_product_count=info["active_product_count"],
        index_version=info["index_version"],
    )


@app.post("/v1/admin/sync-catalog", response_model=SyncCatalogResponse)
def sync_catalog(x_vision_internal_secret: str | None = Header(default=None)) -> SyncCatalogResponse:
    _ensure_internal_secret(x_vision_internal_secret)
    if catalog_sync_service is None:
        raise HTTPException(status_code=503, detail="OpenCLIP model is not ready")
    try:
        response = catalog_sync_service.run_full_sync()
    except CatalogSyncInProgressError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if image_search_service is not None:
        image_search_service.refresh_index_info()
    return response


@app.get("/v1/metrics", response_model=SearchMetricsResponse)
def metrics(x_vision_internal_secret: str | None = Header(default=None)) -> SearchMetricsResponse:
    _ensure_internal_secret(x_vision_internal_secret)
    snapshot = search_metrics.snapshot()
    return SearchMetricsResponse(
        total_requests=snapshot.total_requests,
        accepted_requests=snapshot.accepted_requests,
        low_confidence_requests=snapshot.low_confidence_requests,
        empty_requests=snapshot.empty_requests,
        invalid_content_type_requests=snapshot.invalid_content_type_requests,
        empty_payload_requests=snapshot.empty_payload_requests,
        oversized_payload_requests=snapshot.oversized_payload_requests,
        decode_error_requests=snapshot.decode_error_requests,
        threshold_filtered_candidates=snapshot.threshold_filtered_candidates,
        total_grouped_candidates=snapshot.total_grouped_candidates,
        total_returned_candidates=snapshot.total_returned_candidates,
        average_top_score=snapshot.average_top_score,
        average_grouped_candidates=snapshot.average_grouped_candidates,
        average_returned_candidates=snapshot.average_returned_candidates,
        average_search_latency_ms=snapshot.average_search_latency_ms,
        average_encode_latency_ms=snapshot.average_encode_latency_ms,
        average_db_query_latency_ms=snapshot.average_db_query_latency_ms,
        search_latency_p50_ms=snapshot.search_latency_p50_ms,
        search_latency_p95_ms=snapshot.search_latency_p95_ms,
        search_latency_p99_ms=snapshot.search_latency_p99_ms,
        encode_latency_p50_ms=snapshot.encode_latency_p50_ms,
        encode_latency_p95_ms=snapshot.encode_latency_p95_ms,
        encode_latency_p99_ms=snapshot.encode_latency_p99_ms,
        db_query_latency_p50_ms=snapshot.db_query_latency_p50_ms,
        db_query_latency_p95_ms=snapshot.db_query_latency_p95_ms,
        db_query_latency_p99_ms=snapshot.db_query_latency_p99_ms,
        last_status=snapshot.last_status,
        last_empty_reason=snapshot.last_empty_reason,
        last_top_score=snapshot.last_top_score,
        last_score_floor=snapshot.last_score_floor,
        last_search_latency_ms=snapshot.last_search_latency_ms,
        last_encode_latency_ms=snapshot.last_encode_latency_ms,
        last_db_query_latency_ms=snapshot.last_db_query_latency_ms,
        last_search_at=snapshot.last_search_at,
        empty_reason_counts=snapshot.empty_reason_counts,
    )


@app.post("/v1/search/image", response_model=SearchResponse)
async def search_image(
    file: UploadFile = File(...),
    limit: int = Query(default=120, ge=1, le=120),
    category_slug: str | None = Query(default=None),
    store_slug: str | None = Query(default=None),
    x_vision_internal_secret: str | None = Header(default=None),
) -> SearchResponse:
    _ensure_internal_secret(x_vision_internal_secret)

    if image_search_service is None:
        raise HTTPException(status_code=503, detail="OpenCLIP model is not ready")

    payload = await file.read()
    try:
        result = image_search_service.search_bytes(
            content_type=file.content_type,
            payload=payload,
            limit=limit,
            category_slug=category_slug,
            store_slug=store_slug,
        )
    except SearchValidationError as exc:
        search_metrics.record_request(status=exc.metrics_status)
        raise HTTPException(status_code=exc.status_code, detail=exc.detail) from exc

    logger.info(
        "image_search status=%s empty_reason=%s content_type=%s bytes=%s grouped=%s returned=%s threshold_filtered=%s top_score=%s score_floor=%s search_ms=%.2f encode_ms=%.2f db_ms=%.2f category_slug=%s store_slug=%s",
        result.status,
        result.empty_reason or "-",
        file.content_type or "unknown",
        len(payload),
        result.grouped_candidate_count,
        len(result.candidates),
        result.threshold_filtered_count,
        format_score(result.top_score),
        format_score(result.score_floor),
        result.search_latency_ms,
        result.encode_latency_ms,
        result.db_query_latency_ms,
        category_slug or "-",
        store_slug or "-",
    )
    search_metrics.record_request(
        status=result.status,
        grouped_candidates=result.grouped_candidate_count,
        returned_candidates=len(result.candidates),
        threshold_filtered_count=result.threshold_filtered_count,
        top_score=result.top_score,
        score_floor=result.score_floor,
        empty_reason=result.empty_reason,
        search_latency_ms=result.search_latency_ms,
        encode_latency_ms=result.encode_latency_ms,
        db_query_latency_ms=result.db_query_latency_ms,
    )
    return SearchResponse(
        candidates=result.candidates,
        total_candidates=len(result.candidates),
        index_version=result.index_version,
    )


def _ensure_internal_secret(provided_secret: str | None) -> None:
    if not settings.vision_internal_secret:
        raise HTTPException(status_code=503, detail="Vision internal secret is not configured")
    if not provided_secret or provided_secret != settings.vision_internal_secret:
        raise HTTPException(status_code=403, detail="Invalid vision internal secret")
