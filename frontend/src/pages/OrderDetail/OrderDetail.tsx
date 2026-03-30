import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight, Package, Truck, CheckCircle2, XCircle, Clock,
  MapPin, Phone, CreditCard, ArrowLeft, RotateCcw, Copy, X, AlertTriangle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { orderService } from '../../services/orderService';
import { formatPrice } from '../../utils/formatters';
import { CLIENT_TEXT } from '../../utils/texts';
import type { Order } from '../../types';
import './OrderDetail.css';
import '../../styles/orderDetailTheme.css';

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

const OrderDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadOrder = async () => {
      try {
        setIsLoading(true);
        if (!id) {
          if (mounted) setOrder(null);
          return;
        }
        const data = await orderService.getByIdFromBackend(id);
        if (!mounted) return;
        setOrder(data);
      } catch (error: unknown) {
        if (!mounted) return;
        setOrder(null);
        const message = error instanceof Error ? error.message : 'Không thể tải chi tiết đơn hàng.';
        addToast(message, 'error');
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadOrder();
    return () => {
      mounted = false;
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
            <div className="od-card">
              <h3 className="od-card-title">Trạng thái đơn hàng</h3>
              <div className="od-timeline">
                {order.statusSteps.map((step, idx) => (
                  <div key={idx} className={`od-tl-step done`}>
                    <div className="od-tl-dot">
                      {step.label.includes('Đặt') ? <Clock size={16} /> :
                       step.label.includes('Xác nhận') ? <CheckCircle2 size={16} /> :
                       step.label.includes('giao') ? <Truck size={16} /> :
                       step.label.includes('hủy') ? <XCircle size={16} /> :
                       <Package size={16} />}
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

            <div className="od-card">
              <h3 className="od-card-title">Sản phẩm ({order.items.length})</h3>
              <div className="od-items">
                {order.items.map((item, idx) => (
                  <div key={idx} className="od-item">
                    <img src={item.image} alt={item.name} className="od-item-img" />
                    <div className="od-item-info">
                      <p className="od-item-name">{item.name}</p>
                      {item.color && <p className="od-item-variant">Màu: {item.color}</p>}
                      {item.size && <p className="od-item-variant">Size: {item.size}</p>}
                      <p className="od-item-qty">x{item.quantity}</p>
                    </div>
                    <span className="od-item-price">{formatPrice(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>
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
                  <button className="od-action-btn od-btn-primary">Đánh giá sản phẩm</button>
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
              <p className="od-reason-label">Lý do hủy đơ:</p>
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
    </div>
  );
};

export default OrderDetail;
