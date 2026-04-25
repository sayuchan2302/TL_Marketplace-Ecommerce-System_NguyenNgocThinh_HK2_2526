import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Phone,
  CreditCard,
  ArrowLeft,
  RotateCcw,
  Copy,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { orderService } from '../../services/orderService';
import { authService } from '../../services/authService';
import { reviewService, type EligibleReviewItem, type Review } from '../../services/reviewService';
import ReviewModal from '../../components/ReviewModal/ReviewModal';
import { formatPrice } from '../../utils/formatters';
import { CLIENT_TEXT } from '../../utils/texts';
import type { Order } from '../../types';
import './OrderDetail.css';
import '../../styles/orderDetailTheme.css';
import { getOptimizedImageUrl } from '../../utils/getOptimizedImageUrl';
import { resolveAvatarSrc } from '../../utils/avatar';

const t = CLIENT_TEXT.common;

const CANCEL_REASONS = [
  'Tôi muốn thay đổi địa chỉ giao hàng',
  'Tôi muốn thay đổi sản phẩm (size/màu)',
  'Tôi tìm thấy giá tốt hơn ở nơi khác',
  'Tôi không còn cần sản phẩm này',
  'Đặt nhầm / thay đổi ý định',
  'Lý do khác',
];

const statusColorMap: Record<string, string> = {
  delivered: 'status-delivered',
  shipping: 'status-shipping',
  processing: 'status-processing',
  cancelled: 'status-cancelled',
  refunded: 'status-refunded',
};

interface ReviewProduct {
  productId: string;
  productName: string;
  productImage: string;
  orderId: string;
  variant?: string;
}

const mapEligibleToReviewProduct = (item: EligibleReviewItem): ReviewProduct => {
  const variant = [
    item.variantName?.trim() || null,
    item.quantity > 0 ? `Số lượng: ${item.quantity}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    productId: item.productId,
    productName: item.productName,
    productImage: item.productImage,
    orderId: item.orderId,
    variant: variant || 'Đơn hàng đã giao',
  };
};

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolvingReview, setIsResolvingReview] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<ReviewProduct | null>(null);
  const [orderReviews, setOrderReviews] = useState<Review[]>([]);
  const [isLoadingOrderReviews, setIsLoadingOrderReviews] = useState(false);

  const sessionUser = authService.getSession()?.user;

  const reviewerName: string = useMemo(
    () => sessionUser?.name?.trim() || 'Khách hàng',
    [sessionUser?.name],
  );

  const reviewerAvatarSrc = useMemo(
    () => resolveAvatarSrc(sessionUser?.avatar),
    [sessionUser?.avatar],
  );

  const reviewerInitial = useMemo(
    () =>
      reviewerName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part: string) => part.charAt(0).toUpperCase())
        .join('') || 'U',
    [reviewerName],
  );

  const loadOrderReviews = useCallback(
    async (orderId: string, options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      try {
        setIsLoadingOrderReviews(true);
        const rows = await reviewService.getReviewsByOrder(orderId);
        setOrderReviews(rows);
      } catch (error: unknown) {
        if (!silent) {
          const message = error instanceof Error ? error.message : 'Không thể tải danh sách đánh giá của đơn hàng.';
          addToast(message, 'error');
        }
      } finally {
        setIsLoadingOrderReviews(false);
      }
    },
    [addToast],
  );

  useEffect(() => {
    let mounted = true;

    const loadOrder = async (options?: { silent?: boolean; withLoading?: boolean }) => {
      const silent = options?.silent ?? false;
      const withLoading = options?.withLoading ?? false;
      try {
        if (withLoading) {
          setIsLoading(true);
        }
        if (!id) {
          if (mounted) setOrder(null);
          return;
        }
        const data = await orderService.getByIdFromBackend(id);
        if (!mounted) return;
        setOrder(data);
      } catch (error: unknown) {
        if (!mounted) return;
        if (!silent) {
          setOrder(null);
          const message = error instanceof Error ? error.message : 'Không thể tải chi tiết đơn hàng.';
          addToast(message, 'error');
        }
      } finally {
        if (withLoading && mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadOrder({ withLoading: true });

    const refreshInterval = window.setInterval(() => {
      if (!mounted || !id || document.visibilityState !== 'visible') {
        return;
      }
      void loadOrder({ silent: true });
    }, 15000);

    const handleWindowFocus = () => {
      if (!mounted || !id) {
        return;
      }
      void loadOrder({ silent: true });
    };

    window.addEventListener('focus', handleWindowFocus);

    return () => {
      mounted = false;
      window.removeEventListener('focus', handleWindowFocus);
      window.clearInterval(refreshInterval);
    };
  }, [addToast, id]);

  const handleCancelOrder = async () => {
    if (!order) return;
    const finalReason = selectedReason === 'Lý do khác' ? otherReason : selectedReason;
    if (!finalReason) {
      addToast('Vui lòng chọn hoặc nhập lý do hủy đơn', 'error');
      return;
    }
    try {
      const updated = await orderService.cancelOnBackend(order.id, finalReason);
      if (updated) {
        setOrder(updated);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể hủy đơn hàng.';
      addToast(message, 'error');
      return;
    }
    addToast('Đã hủy đơn hàng thành công!', 'success');
    setIsCancelModalOpen(false);
    setTimeout(() => navigate('/profile'), 1500);
  };

  const handleCopyTracking = () => {
    if (order?.tracking) {
      navigator.clipboard.writeText(order.tracking);
      addToast('Đã sao chép mã vận đơn!', 'success');
    }
  };

  const handleReviewOrder = async () => {
    if (!order || order.status !== 'delivered' || isResolvingReview) return;

    try {
      setIsResolvingReview(true);
      const eligibleItems = await reviewService.getEligibleReviews();
      const orderEligibleItems = eligibleItems.filter((item) => item.orderId === order.id);

      if (orderEligibleItems.length === 0) {
        addToast('Đơn hàng này đã đánh giá hết hoặc chưa đủ điều kiện đánh giá.', 'info');
        return;
      }

      setReviewProduct(mapEligibleToReviewProduct(orderEligibleItems[0]));
      setIsReviewModalOpen(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu đánh giá.';
      addToast(message, 'error');
    } finally {
      setIsResolvingReview(false);
    }
  };

  const handleCloseReviewModal = () => {
    setIsReviewModalOpen(false);
    setReviewProduct(null);
    if (order?.id) {
      void loadOrderReviews(order.id, { silent: true });
    }
  };

  useEffect(() => {
    if (!order?.id || order.status !== 'delivered') {
      setOrderReviews([]);
      return;
    }
    void loadOrderReviews(order.id, { silent: true });
  }, [loadOrderReviews, order?.id, order?.status]);

  if (isLoading) {
    return (
      <div className="od-page od-theme od-theme-client">
        <div className="od-container">
          <div className="od-not-found">
            <h2>Đang tải đơn hàng...</h2>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="od-page od-theme od-theme-client">
        <div className="od-container">
          <div className="od-not-found">
            <Package size={64} strokeWidth={1} />
            <h2>Không tìm thấy đơn hàng</h2>
            <p>Đơn hàng #{id} không tồn tại hoặc đã bị xoá.</p>
            <Link to="/profile?tab=orders" className="od-back-link">Quay lại lịch sử đơn hàng</Link>
          </div>
        </div>
      </div>
    );
  }

  const addressParts = order.addressSummary.split(',');
  const shippingName = addressParts[0]?.trim() || '';
  const shippingPhone = addressParts[1]?.trim() || '';
  const shippingAddress = addressParts.slice(2).join(',').trim() || '';
  const totalProductQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);
  const itemByProductId = new Map(order.items.map((item) => [String(item.productId || item.id), item]));

  return (
    <div className="od-page od-theme od-theme-client">
      <div className="od-container">
        <div className="od-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <ChevronRight size={14} />
          <Link to="/profile">Tài khoản</Link>
          <ChevronRight size={14} />
          <span>Đơn hàng #{order.code || order.id}</span>
        </div>

        <div className="od-header">
          <Link to="/profile?tab=orders" className="od-back-btn">
            <ArrowLeft size={18} /> Quay lại
          </Link>
          <div className="od-header-info">
            <h1>Đơn hàng <span className="od-order-id">#{order.code || order.id}</span></h1>
            <span className="od-date">Ngày đặt: {new Date(order.createdAt).toLocaleString('vi-VN')}</span>
          </div>
          <span className={`od-status-badge ${statusColorMap[order.status]}`}>{t.status[order.status]}</span>
        </div>

        <div className="od-grid">
          <div className="od-left">
            <div className="od-card od-items-card">
              <h3 className="od-card-title">Trạng thái đơn hàng</h3>
              <div className="od-timeline">
                {order.statusSteps.map((step, idx) => (
                  <div key={idx} className="od-tl-step done">
                    <div className="od-tl-dot">
                      {step.label.includes('Đặt') ? <Clock size={16} />
                        : step.label.includes('Xác nhận') ? <CheckCircle2 size={16} />
                          : step.label.includes('giao') ? <Truck size={16} />
                            : step.label.includes('hủy') ? <XCircle size={16} />
                              : <Package size={16} />}
                    </div>
                    <div className="od-tl-content">
                      <span className="od-tl-label">{step.label}</span>
                      {step.timestamp && <span className="od-tl-time">{step.timestamp}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {order.tracking && (
                <div className="od-tracking">
                  <span className="od-tracking-label">Mã vận đơn:</span>
                  <code className="od-tracking-code">{order.tracking}</code>
                  <button className="od-tracking-copy" onClick={handleCopyTracking}><Copy size={14} /> Sao chép</button>
                </div>
              )}
            </div>

            <div className="od-card od-products-card">
              <h3 className="od-card-title">Sản phẩm ({order.items.length})</h3>
              <div className="od-items">
                {order.items.map((item, idx) => {
                  const lineTotal = item.price * item.quantity;
                  const productIdentifier = String(item.productSlug || item.productId || item.id || '').trim();
                  const productHref = productIdentifier ? `/product/${encodeURIComponent(productIdentifier)}` : '';

                  return (
                    <div key={idx} className="od-item">
                      {productHref ? (
                        <Link to={productHref} className="od-item-link" title="Xem chi tiết sản phẩm">
                          <img src={getOptimizedImageUrl(item.image, { width: 240, format: 'webp' })} alt={item.name} className="od-item-img" />
                          <div className="od-item-info">
                            <p className="od-item-name">{item.name}</p>
                            <div className="od-item-meta">
                              {item.color && <span className="od-item-meta-chip">Màu: {item.color}</span>}
                              {item.size && <span className="od-item-meta-chip">Size: {item.size}</span>}
                              <span className="od-item-meta-chip od-item-meta-chip-qty">SL: {item.quantity}</span>
                            </div>
                          </div>
                        </Link>
                      ) : (
                        <>
                          <img src={getOptimizedImageUrl(item.image, { width: 240, format: 'webp' })} alt={item.name} className="od-item-img" />
                          <div className="od-item-info">
                            <p className="od-item-name">{item.name}</p>
                            <div className="od-item-meta">
                              {item.color && <span className="od-item-meta-chip">Màu: {item.color}</span>}
                              {item.size && <span className="od-item-meta-chip">Size: {item.size}</span>}
                              <span className="od-item-meta-chip od-item-meta-chip-qty">SL: {item.quantity}</span>
                            </div>
                          </div>
                        </>
                      )}
                      <div className="od-item-pricing">
                        <span className="od-item-price-label">Đơn giá</span>
                        <span className="od-item-price">{formatPrice(item.price)}</span>
                        <span className="od-item-line-total">Thành tiền: {formatPrice(lineTotal)}</span>
                        {productHref && (
                          <Link to={productHref} className="od-item-detail-link">
                            Xem sản phẩm
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="od-items-footer">
                <span>{order.items.length} sản phẩm, {totalProductQuantity} món</span>
                <span>Tạm tính: <strong>{formatPrice(order.total)}</strong></span>
              </div>
            </div>

            {order.status === 'delivered' ? (
              <div className="od-card od-reviews-card">
                <div className="od-reviews-head">
                  <h3 className="od-card-title od-reviews-title">Đánh giá của bạn</h3>
                  <span className="od-reviews-count">{orderReviews.length} đánh giá</span>
                </div>

                {isLoadingOrderReviews ? (
                  <div className="od-reviews-empty">Đang tải danh sách đánh giá...</div>
                ) : orderReviews.length === 0 ? (
                  <div className="od-reviews-empty">Bạn chưa đánh giá sản phẩm nào trong đơn hàng này.</div>
                ) : (
                  <div className="od-reviews-list">
                    {orderReviews.map((review) => {
                      const linkedItem = itemByProductId.get(String(review.productId || ''));
                      const fallbackImage = linkedItem?.image || '';
                      const reviewImage = review.productImage || fallbackImage;
                      const reviewProductId = String(review.productSlug || review.productId || '').trim();
                      const reviewProductHref = reviewProductId
                        ? `/product/${encodeURIComponent(reviewProductId)}`
                        : '';

                      return (
                        <article key={review.id} className="od-review-item">
                          <div className="od-review-author">
                            {reviewerAvatarSrc ? (
                              <img
                                src={reviewerAvatarSrc}
                                alt={reviewerName}
                                className="od-review-avatar"
                              />
                            ) : (
                              <div className="od-review-avatar od-review-avatar-fallback" aria-hidden="true">
                                {reviewerInitial}
                              </div>
                            )}
                            <div className="od-review-author-meta">
                              <p className="od-review-author-name">{reviewerName}</p>
                              <p className="od-review-date">{new Date(review.createdAt).toLocaleString('vi-VN')}</p>
                            </div>
                          </div>

                          <div className="od-review-product">
                            {reviewImage ? (
                              <img
                                src={getOptimizedImageUrl(reviewImage, { width: 180, format: 'webp' })}
                                alt={review.productName}
                                className="od-review-product-image"
                              />
                            ) : null}
                            <div className="od-review-product-meta">
                              {reviewProductHref ? (
                                <Link to={reviewProductHref} className="od-review-product-name">
                                  {review.productName}
                                </Link>
                              ) : (
                                <p className="od-review-product-name">{review.productName}</p>
                              )}
                              <div className="od-review-stars" aria-label={`${review.rating} sao`}>
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <span
                                    key={`${review.id}-star-${star}`}
                                    className={`od-review-star ${star <= review.rating ? 'active' : ''}`}
                                  >
                                    ★
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <p className="od-review-content">{review.content}</p>

                          {review.images && review.images.length > 0 ? (
                            <div className="od-review-images">
                              {review.images.map((imageUrl, index) => (
                                <img
                                  key={`${review.id}-image-${index}`}
                                  src={getOptimizedImageUrl(imageUrl, { width: 220, format: 'webp' })}
                                  alt={`Ảnh đánh giá ${index + 1}`}
                                  className="od-review-image"
                                />
                              ))}
                            </div>
                          ) : null}

                          {review.shopReply ? (
                            <div className="od-review-reply">
                              <p className="od-review-reply-label">Phản hồi từ shop</p>
                              <p className="od-review-reply-content">{review.shopReply.content}</p>
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          <div className="od-right">
            <div className="od-card">
              <h3 className="od-card-title"><MapPin size={16} /> Thông tin giao hàng</h3>
              <div className="od-info-block">
                <p className="od-info-name">{shippingName}</p>
                <p className="od-info-phone"><Phone size={14} /> {shippingPhone}</p>
                <p className="od-info-address">{shippingAddress}</p>
              </div>
            </div>

            <div className="od-card">
              <h3 className="od-card-title"><CreditCard size={16} /> Phương thức thanh toán</h3>
              <p className="od-payment-method">{order.paymentMethod}</p>
            </div>

            <div className="od-card">
              <h3 className="od-card-title">Chi tiết thanh toán</h3>
              <div className="od-summary">
                <div className="od-sum-row">
                  <span>Tạm tính</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
                <div className="od-sum-row">
                  <span>Phí vận chuyển</span>
                  <span>Miễn phí</span>
                </div>
                {order.cancelReason && (
                  <div className="od-sum-row">
                    <span>Trạng thái</span>
                    <span>Đã hủy: {order.cancelReason}</span>
                  </div>
                )}
                <div className="od-sum-row od-total-row">
                  <span>Tổng cộng</span>
                  <span className="od-total-price">{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>

            <div className="od-card od-actions-card">
              {order.status === 'delivered' && (
                <>
                  <button
                    className="od-action-btn od-btn-primary"
                    onClick={() => void handleReviewOrder()}
                    disabled={isResolvingReview}
                  >
                    {isResolvingReview ? 'Đang tải...' : 'Đánh giá sản phẩm'}
                  </button>
                  <button className="od-action-btn od-btn-outline"><RotateCcw size={16} /> Đổi / trả hàng</button>
                </>
              )}
              {order.status === 'shipping' && (
                <button className="od-action-btn od-btn-primary">Xác nhận đã nhận hàng</button>
              )}
              {(order.status === 'pending' || order.status === 'processing') && (
                <>
                  <button
                    className="od-action-btn od-btn-danger"
                    onClick={() => setIsCancelModalOpen(true)}
                  >
                    <XCircle size={16} /> Hủy đơn hàng
                  </button>
                </>
              )}
              {order.status === 'cancelled' && (
                <button className="od-action-btn od-btn-primary">Mua lại</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {isCancelModalOpen && (
        <div className="od-modal-overlay">
          <div className="od-cancel-modal">
            <button className="od-modal-close" onClick={() => setIsCancelModalOpen(false)}>
              <X size={20} />
            </button>
            <div className="od-modal-icon">
              <AlertTriangle size={32} />
            </div>
            <h3 className="od-modal-title">Xác nhận hủy đơn hàng</h3>
            <p className="od-modal-desc">
              Bạn có chắc chắn muốn hủy đơn hàng <strong>#{order.code || order.id}</strong>?
              Hành động này không thể hoàn tác.
            </p>

            <div className="od-cancel-reasons">
              <p className="od-reason-label">Lý do hủy đơn:</p>
              {CANCEL_REASONS.map((reason) => (
                <label key={reason} className="od-reason-option">
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                  />
                  <span className="od-reason-text">{reason}</span>
                </label>
              ))}
            </div>

            {selectedReason === 'Lý do khác' && (
              <textarea
                className="od-reason-input"
                placeholder="Nhập lý do của bạn..."
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                rows={3}
              />
            )}

            <div className="od-modal-actions">
              <button
                className="od-btn-cancel-action"
                onClick={() => setIsCancelModalOpen(false)}
              >
                Không, giữ đơn
              </button>
              <button
                className="od-btn-confirm-cancel"
                onClick={handleCancelOrder}
              >
                Xác nhận hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {reviewProduct ? (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={handleCloseReviewModal}
          product={reviewProduct}
        />
      ) : null}
    </div>
  );
};

export default OrderDetail;
