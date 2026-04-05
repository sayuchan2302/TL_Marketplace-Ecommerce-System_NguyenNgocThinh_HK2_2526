import { Link, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './Account.css';
import { orderService } from '../../services/orderService';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { formatPrice } from '../../utils/formatters';
import { toDisplayOrderCode } from '../../utils/displayCode';
import { getOptimizedImageUrl } from '../../utils/getOptimizedImageUrl';

const OrderDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Awaited<ReturnType<typeof orderService.getByIdFromBackend>>>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { addToCart } = useCart();
  const { addToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const loadOrder = async () => {
      try {
        setIsLoading(true);
        if (!id) {
          if (mounted) setOrder(null);
          return;
        }
        const fresh = await orderService.getByIdFromBackend(id);
        if (!mounted) return;
        setOrder(fresh);
      } catch (error: unknown) {
        if (!mounted) return;
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

  if (isLoading) {
    return (
      <div className="account-page">
        <div className="account-container">
          <h1 className="account-title">Đang tải đơn hàng...</h1>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="account-page">
        <div className="account-container">
          <h1 className="account-title">Không tìm thấy đơn hàng</h1>
          <Link to="/account/orders" className="btn-secondary">Quay lại danh sách</Link>
        </div>
      </div>
    );
  }

  const handleReorder = () => {
    order.items.forEach((item) => {
      addToCart({
        id: item.id,
        name: item.name,
        price: item.price,
        originalPrice: item.originalPrice,
        image: item.image,
        color: item.color || 'Mặc định',
        size: item.size || 'F',
        storeId: order.storeId,
        storeName: order.storeName,
      });
    });
    addToast('Đã thêm sản phẩm vào giỏ', 'success');
    navigate('/cart');
  };

  return (
    <div className="account-page">
      <div className="account-container">
        <div className="account-header">
          <div>
            <h1 className="account-title">Đơn hàng {toDisplayOrderCode(order.code || order.id)}</h1>
            <p className="account-subtitle">Ngày đặt: {new Date(order.createdAt).toLocaleString('vi-VN')}</p>
          </div>
          <div className="account-actions">
            <button className="btn-secondary" onClick={() => navigate('/account/orders')}>Quay lại</button>
            <button className="btn-primary" onClick={handleReorder}>Mua lại</button>
          </div>
        </div>

        <div className="order-detail-grid">
          <div>
            <h3>Trạng thái vận chuyển</h3>
            <div className="timeline">
              {order.statusSteps.map((step) => (
                <div className="timeline-step" key={step.timestamp + step.label}>
                  <strong>{step.label}</strong>
                  <div className="account-meta">{step.timestamp}</div>
                  {step.description && <div className="account-meta">{step.description}</div>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3>Thông tin giao hàng</h3>
            <div className="account-card">
              <div>
                <div className="account-meta">{order.addressSummary}</div>
                <div className="account-meta">Phương thức thanh toán: {order.paymentMethod}</div>
                <div className="account-meta"><strong>Tổng tiền:</strong> {formatPrice(order.total)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="account-section">
          <h3>Sản phẩm</h3>
          <table className="order-items-table">
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Thuộc tính</th>
                <th>Số lượng</th>
                <th>Giá</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id + item.color + item.size}>
                  <td style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src={getOptimizedImageUrl(item.image, { width: 100, format: 'webp' })} alt={item.name} />
                    <div>
                      <div>{item.name}</div>
                    </div>
                  </td>
                  <td>
                    <div className="account-meta">Màu: {item.color || 'N/A'}</div>
                    <div className="account-meta">Size: {item.size || 'N/A'}</div>
                  </td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OrderDetailPage;
