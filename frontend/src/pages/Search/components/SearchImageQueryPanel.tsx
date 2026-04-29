import { ImagePlus, RotateCcw } from 'lucide-react';
import type { ClipboardEventHandler, RefObject } from 'react';
import SearchImagePasteTarget from './SearchImagePasteTarget';

interface SearchImageQueryPanelProps {
  fileName: string;
  previewUrl: string;
  totalCandidates: number;
  inferredCategory?: string;
  inferredCategoryScore?: number;
  categoryFilterApplied?: string;
  pasteTargetRef: RefObject<HTMLDivElement | null>;
  onPickImage: () => void;
  onFocusPasteTarget: () => void;
  onClear: () => void;
  onPaste: ClipboardEventHandler<HTMLDivElement>;
}

const formatMetadataValue = (value: string) => value.trim();

const formatConfidenceScore = (value: number) => value.toFixed(2);

const SearchImageQueryPanel = ({
  fileName,
  previewUrl,
  totalCandidates,
  inferredCategory,
  inferredCategoryScore,
  categoryFilterApplied,
  pasteTargetRef,
  onPickImage,
  onFocusPasteTarget,
  onClear,
  onPaste,
}: SearchImageQueryPanelProps) => {
  const hasMetadata = Boolean(
    inferredCategory
    || typeof inferredCategoryScore === 'number'
    || categoryFilterApplied,
  );

  return (
    <>
      <div className="search-visual-query">
        <div className="search-visual-query__preview">
          <img src={previewUrl} alt={fileName} />
        </div>
        <div className="search-visual-query__meta">
          <div className="search-visual-query__label">Ảnh đang dùng để tìm kiếm</div>
          <div className="search-visual-query__name">{fileName}</div>
          <div className="search-visual-query__sub">{totalCandidates} kết quả phù hợp</div>
          {hasMetadata && (
            <div className="search-visual-query__metadata" aria-label="Thông tin nhận diện ảnh">
              {inferredCategory && (
                <div className="search-visual-query__metadata-item">
                  <span className="search-visual-query__metadata-key">Danh mục nhận diện:</span>
                  <span>{formatMetadataValue(inferredCategory)}</span>
                </div>
              )}
              {typeof inferredCategoryScore === 'number' && (
                <div className="search-visual-query__metadata-item">
                  <span className="search-visual-query__metadata-key">Độ tin cậy:</span>
                  <span>{formatConfidenceScore(inferredCategoryScore)}</span>
                </div>
              )}
              {categoryFilterApplied && (
                <div className="search-visual-query__metadata-item">
                  <span className="search-visual-query__metadata-key">Chế độ lọc:</span>
                  <span>{formatMetadataValue(categoryFilterApplied)}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="search-visual-query__actions">
          <button type="button" className="search-visual-query__button" onClick={onPickImage}>
            <ImagePlus size={16} aria-hidden="true" />
            Chọn ảnh khác
          </button>
          <button type="button" className="search-visual-query__button" onClick={onFocusPasteTarget}>
            <ImagePlus size={16} aria-hidden="true" />
            Dán ảnh khác
          </button>
          <button
            type="button"
            className="search-visual-query__button search-visual-query__button--ghost"
            onClick={onClear}
          >
            <RotateCcw size={16} aria-hidden="true" />
            Xóa tìm kiếm ảnh
          </button>
        </div>
      </div>

      <SearchImagePasteTarget
        ariaLabel="Dán ảnh khác từ clipboard để tìm kiếm"
        title="Dán ảnh khác từ clipboard"
        description="Bạn có thể paste trực tiếp ảnh mới tại đây thay vì phải mở file từ máy."
        className="search-image-paste--compact"
        pasteTargetRef={pasteTargetRef}
        onClick={onFocusPasteTarget}
        onPaste={onPaste}
      />
    </>
  );
};

export default SearchImageQueryPanel;
