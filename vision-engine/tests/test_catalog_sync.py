from __future__ import annotations

from io import BytesIO
from pathlib import Path
import sys
from datetime import UTC, datetime
import unittest
from unittest.mock import Mock, patch

from PIL import Image


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.catalog_sync import CatalogSyncError, CatalogSyncInProgressError, CatalogSyncService  # noqa: E402
from app.models import VisionCatalogPage  # noqa: E402


class CatalogSyncServiceTests(unittest.TestCase):
    def _build_png_bytes(self, *, width: int = 8, height: int = 8) -> bytes:
        image = Image.new("RGB", (width, height), color="green")
        buffer = BytesIO()
        image.save(buffer, format="PNG")
        return buffer.getvalue()

    def test_download_image_rejects_large_content_length_header(self) -> None:
        service = CatalogSyncService(clip_service=Mock())
        response = Mock()
        response.headers = {"Content-Length": "9999"}
        response.iter_content.return_value = iter([self._build_png_bytes()])
        response.raise_for_status.return_value = None
        response.close.return_value = None
        service.http.get = Mock(return_value=response)

        with patch("app.catalog_sync.settings.max_catalog_image_download_bytes", 100):
            with self.assertRaises(CatalogSyncError) as context:
                service._download_image("https://example.com/image.png")

        self.assertEqual(context.exception.reason, "download_too_large")
        response.close.assert_called_once()

    def test_decode_downloaded_image_rejects_large_decoded_pixels(self) -> None:
        service = CatalogSyncService(clip_service=Mock())
        payload = self._build_png_bytes(width=20, height=20)

        with patch("app.catalog_sync.settings.max_image_pixels", 100):
            with self.assertRaises(CatalogSyncError) as context:
                service._decode_downloaded_image(payload)

        self.assertIn(context.exception.reason, {"decoded_pixels_too_large", "decompression_bomb"})

    def test_decode_downloaded_image_rejects_corrupt_payload(self) -> None:
        service = CatalogSyncService(clip_service=Mock())

        with self.assertRaises(CatalogSyncError) as context:
            service._decode_downloaded_image(b"corrupt")

        self.assertEqual(context.exception.reason, "decode_error")

    def test_run_full_sync_falls_back_to_full_backfill_when_index_is_incomplete(self) -> None:
        service = CatalogSyncService(clip_service=Mock())
        page = VisionCatalogPage(items=[], totalProducts=877, page=0, size=100, totalPages=1, generatedAt=None)

        with patch.object(service, "_resolve_updated_since_cursor", return_value=datetime(2026, 4, 28, tzinfo=UTC)):
            with patch.object(service, "_count_missing_public_products_from_index", return_value=522):
                with patch.object(service, "_fetch_catalog_page", return_value=page) as fetch_catalog_page:
                    with patch.object(service, "_resolve_index_version", return_value="index-version"):
                        with patch.object(service, "_deactivate_stale_rows", return_value=0):
                            response = service.run_full_sync()

        fetch_catalog_page.assert_called_once_with(page=0, updated_since=None)
        self.assertEqual(response.synced_rows, 0)
        self.assertEqual(response.failed_rows, 0)
        self.assertEqual(response.index_version, "index-version")

    def test_run_full_sync_rejects_parallel_execution(self) -> None:
        service = CatalogSyncService(clip_service=Mock())
        acquired = service._run_lock.acquire(blocking=False)
        self.assertTrue(acquired)
        try:
            with self.assertRaises(CatalogSyncInProgressError):
                service.run_full_sync()
        finally:
            service._run_lock.release()


if __name__ == "__main__":
    unittest.main()
