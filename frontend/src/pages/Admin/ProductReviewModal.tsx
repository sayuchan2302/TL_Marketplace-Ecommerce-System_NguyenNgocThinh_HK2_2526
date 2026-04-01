import { useEffect, useState } from 'react';
import { ShieldBan, CheckCircle2, X, XCircle } from 'lucide-react';
import Drawer from '../../components/Drawer/Drawer';
import type { AdminModerationProduct } from './adminProductModerationService';

interface ProductReviewModalProps {
  open: boolean;
  product: AdminModerationProduct | null;
  onClose: () => void;
  onApprove: (product: AdminModerationProduct) => Promise<void> | void;
  onReject: (product: AdminModerationProduct, reason: string) => Promise<void> | void;
  onBan: (product: AdminModerationProduct) => Promise<void> | void;
  loading?: boolean;
}

const ProductReviewModal = ({
  open,
  product,
  onClose,
  onApprove,
  onReject,
  onBan,
  loading = false,
}: ProductReviewModalProps) => {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  useEffect(() => {
    if (open) {
      setReason('');
      setReasonError('');
    }
  }, [open, product?.id]);

  if (!open || !product) return null;

  const handleReject = async () => {
    const normalized = reason.trim();
    if (!normalized) {
      setReasonError('Vui lòng nhập lý do từ chối.');
      return;
    }
    setReasonError('');
    await onReject(product, normalized);
  };

  const previewImages = (product.images && product.images.length > 0)
    ? product.images
    : (product.thumbnail ? [product.thumbnail] : []);

  return (
    <Drawer open={open} onClose={onClose} className="moderation-review-drawer">
      <div className="drawer-header">
        <div>
          <p className="drawer-eyebrow">Kiểm duyệt sản phẩm</p>
          <h3>{product.productCode}</h3>
        </div>
        <button className="admin-icon-btn" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
      </div>

      <div className="drawer-body">
        <section className="drawer-section">
          <h4>Thông tin sản phẩm</h4>
          <div className="moderation-review-header">
            <img src={product.thumbnail || previewImages[0] || ''} alt={product.name} />
            <div>
              <p className="admin-bold">{product.name}</p>
              <p className="admin-muted small">Mã: {product.productCode}</p>
              <p className="admin-muted small">Gian hàng: {product.storeName}</p>
              <p className="admin-muted small">Danh mục: {product.categoryName}</p>
            </div>
          </div>
        </section>

        <section className="drawer-section moderation-review-grid">
          <div className="moderation-review-panel">
            <h4>Mô tả từ Vendor</h4>
            <p className="moderation-review-description">
              {product.description?.trim() || 'Vendor chưa cập nhật mô tả sản phẩm.'}
            </p>
          </div>
          <div className="moderation-review-panel">
            <h4>Hình ảnh sản phẩm</h4>
            {previewImages.length === 0 ? (
              <p className="admin-muted small">Chưa có ảnh để kiểm duyệt.</p>
            ) : (
              <div className="moderation-review-images">
                {previewImages.map((image, index) => (
                  <img key={`${product.id}-${index}`} src={image} alt={`${product.name}-${index + 1}`} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="drawer-section">
          <h4>Lý do từ chối</h4>
          <textarea
            className="moderation-reject-reason"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Nhập lý do cụ thể để vendor cập nhật lại nội dung sản phẩm..."
          />
          {reasonError ? <p className="moderation-error-text">{reasonError}</p> : null}
        </section>
      </div>

      <div className="drawer-footer moderation-review-actions">
        <button className="admin-ghost-btn" onClick={onClose} disabled={loading}>Đóng</button>
        <button
          className="admin-ghost-btn moderation-btn-approve"
          onClick={() => onApprove(product)}
          disabled={loading}
        >
          <CheckCircle2 size={15} />
          Duyệt
        </button>
        <button
          className="admin-ghost-btn moderation-btn-reject"
          onClick={() => {
            void handleReject();
          }}
          disabled={loading}
        >
          <ShieldBan size={15} />
          Từ chối
        </button>
        <button
          className="admin-ghost-btn moderation-btn-ban"
          onClick={() => onBan(product)}
          disabled={loading}
        >
          <XCircle size={15} />
          Chặn sản phẩm
        </button>
      </div>
    </Drawer>
  );
};

export default ProductReviewModal;
