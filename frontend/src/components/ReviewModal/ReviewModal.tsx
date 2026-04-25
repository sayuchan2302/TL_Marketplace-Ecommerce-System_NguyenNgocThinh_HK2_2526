import { useState, useRef } from 'react';
import { X, Star, Camera } from 'lucide-react';
import { reviewService, type ReviewSubmission } from '../../services/reviewService';
import { useToast } from '../../contexts/ToastContext';
import { CLIENT_TOAST_MESSAGES } from '../../utils/clientMessages';
import { CLIENT_DICTIONARY } from '../../utils/clientDictionary';
import './ReviewModal.css';

interface ProductInfo {
  productId: string;
  productName: string;
  productImage: string;
  orderId: string;
  variant?: string;
}

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductInfo;
  existingReview?: {
    id: string;
    rating: number;
    title: string;
    content: string;
  };
}

const ReviewModal = ({ isOpen, onClose, product, existingReview }: ReviewModalProps) => {
  const t = CLIENT_DICTIONARY.reviews.form;
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rating, setRating] = useState(existingReview?.rating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [content, setContent] = useState(existingReview?.content || '');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  if (!isOpen) return null;

  const isBackendReadyReference = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

  const handleSubmit = async () => {
    if (rating === 0) {
      addToast(CLIENT_TOAST_MESSAGES.review.errorSelectStars, 'error');
      return;
    }
    if (!content.trim()) {
      addToast(CLIENT_TOAST_MESSAGES.review.errorEmptyContent, 'error');
      return;
    }
    if (!isBackendReadyReference(product.productId) || !isBackendReadyReference(product.orderId)) {
      addToast('Dữ liệu đánh giá chưa đồng bộ với đơn hàng backend.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const submission: ReviewSubmission = {
        productId: product.productId,
        productName: product.productName,
        productImage: product.productImage,
        orderId: product.orderId,
        rating,
        content,
        images: images.length > 0 ? images : undefined,
      };

      await reviewService.submitReview(submission);
      addToast(CLIENT_TOAST_MESSAGES.review.pendingModeration, 'success');
      onClose();
    } catch (error: unknown) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Không thể gửi đánh giá. Vui lòng kiểm tra lại đơn hàng đã mua.';
      addToast(message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStarClick = (star: number) => {
    setRating(star);
  };

  const handleStarHover = (star: number) => {
    setHoverRating(star);
  };

  const handleStarLeave = () => {
    setHoverRating(0);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const selectedFiles = Array.from(files);

    const upload = async () => {
      if (images.length >= 5) {
        addToast('Tối đa 5 hình ảnh', 'error');
        return;
      }

      const remainingSlots = 5 - images.length;
      const filesToUpload = selectedFiles.slice(0, remainingSlots);
      if (filesToUpload.length < selectedFiles.length) {
        addToast('Chỉ lấy 5 hình ảnh đầu tiên.', 'info');
      }

      for (const file of filesToUpload) {
        if (!file.type.startsWith('image/')) {
          addToast('Chỉ chấp nhận file hình ảnh', 'error');
          return;
        }

        if (file.size > 5 * 1024 * 1024) {
          addToast('Kích thước file không được vượt quá 5MB', 'error');
          return;
        }
      }

      setIsUploadingImages(true);
      try {
        const uploadedUrls = await Promise.all(filesToUpload.map((file) => reviewService.uploadReviewImage(file)));
        setImages((prev) => Array.from(new Set([...prev, ...uploadedUrls])).slice(0, 5));
      } catch (error: unknown) {
        const message = error instanceof Error && error.message.trim()
          ? error.message
          : 'Tải ảnh review thất bại.';
        addToast(message, 'error');
      } finally {
        setIsUploadingImages(false);
      }
    };

    void upload();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="review-modal-overlay" onClick={onClose}>
      <div className="review-modal" onClick={(e) => e.stopPropagation()}>
        <div className="review-modal-header">
          <div>
            <p className="review-modal-eyebrow">Đánh giá sản phẩm</p>
            <h3 className="review-modal-title">
              {existingReview ? t.editTitle : t.writeTitle}
            </h3>
          </div>
          <button className="review-modal-close" onClick={onClose} aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="review-modal-product">
          <img src={product.productImage} alt={product.productName} className="review-modal-product-img" />
          <div className="review-modal-product-info">
            <p className="review-modal-product-name">{product.productName}</p>
            {product.variant && (
              <p className="review-modal-product-variant">{product.variant}</p>
            )}
          </div>
        </div>

        <div className="review-modal-body">
          <div className="review-modal-rating">
            <label className="review-modal-label">{t.yourRating}</label>
            <div className="review-stars-input">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  className={`review-star-btn ${(hoverRating || rating) >= star ? 'active' : ''}`}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => handleStarHover(star)}
                  onMouseLeave={handleStarLeave}
                >
                  <Star size={32} fill={(hoverRating || rating) >= star ? '#f59e0b' : 'none'} stroke={(hoverRating || rating) >= star ? '#f59e0b' : '#d1d5db'} />
                </button>
              ))}
            </div>
            <p className="review-rating-text">
              {t.ratingText[(hoverRating || rating) as keyof typeof t.ratingText]}
            </p>
          </div>

          <div className="review-modal-form">
            <div className="review-form-group">
              <label className="review-modal-label">{t.contentLabel} <span className="required">{t.contentRequired}</span></label>
              <textarea
                className="review-textarea"
                placeholder={t.contentPlaceholder}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                maxLength={1000}
              />
              <span className="review-char-count">{content.length}/1000</span>
            </div>

            <div className="review-form-group">
              <label className="review-modal-label">{t.imageLabel}</label>
              <div className="review-images-upload">
                {images.map((img, index) => (
                  <div key={index} className="review-image-preview">
                    <img src={img} alt={`Upload ${index + 1}`} />
                    <button
                      type="button"
                      className="review-image-remove"
                      onClick={() => setImages(images.filter((_, i) => i !== index))}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button 
                    type="button" 
                    className="review-image-add"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingImages}
                  >
                    <Camera size={24} />
                    <span>{isUploadingImages ? 'Đang tải...' : t.addImage}</span>
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="review-modal-actions">
          <button type="button" className="review-btn-cancel" onClick={onClose}>
            {t.cancel}
          </button>
          <button
            type="button"
            className="review-btn-submit"
            onClick={handleSubmit}
            disabled={isSubmitting || isUploadingImages}
          >
            {isSubmitting ? t.submitting : existingReview ? t.update : t.submit}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
