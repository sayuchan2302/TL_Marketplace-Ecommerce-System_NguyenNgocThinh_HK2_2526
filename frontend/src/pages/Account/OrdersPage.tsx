import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Account.css';
import { orderService } from '../../services/orderService';
import type { Order } from '../../types';
import Skeleton from '../../components/Skeleton/Skeleton';
import { resolveDetailRouteKey, toDisplayOrderCode } from '../../utils/displayCode';

const statusText: Record<Order['status'], string> = {
  pending: 'Chờ xác nhận',
  processing: 'Đang xử lý',
  shipping: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã hủy',
  refunded: 'Đã hoàn tiền',
};

const OrdersPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadOrders = async () => {
      try {
        setIsLoading(true);
        setLoadError(null);
        const rows = await orderService.listFromBackend();
        if (!mounted) return;
        setOrders(rows);
      } catch (error: unknown) {
        if (!mounted) return;
        const message = error instanceof Error ? error.message : 'Không thể tải danh sách đơn hàng.';
        setLoadError(message);
        setOrders([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    void loadOrders();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="account-page">
      <div className="account-container">
        <div className="account-header">
          <h1 className="account-title">Đơn hàng của tôi</h1>
        </div>
        <p className="account-subtitle">Xem lịch sử đặt hàng và theo dõi trạng thái.</p>

        <div className="order-list">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="order-card order-loading">
                  <Skeleton type="text" width={100} height={24} />
                  <Skeleton type="text" width="60%" />
                  <Skeleton type="text" width="40%" />
                  <Skeleton type="text" width="30%" />
                </div>
              ))}
            </>
          ) : (
            loadError ? (
              <div className="account-meta">{loadError}</div>
            ) : orders.length === 0 ? (
              <div className="account-meta">Chưa có đơn hàng nào.</div>
            ) : (
              orders.map((order) => (
                <div className="order-card" key={order.id}>
                  <div className="order-status">
                    <span className="status-pill">{statusText[order.status]}</span>
                  </div>
                  <div><strong>Mã đơn:</strong> {toDisplayOrderCode(order.code || order.id)}</div>
                  <div><strong>Ngày đặt:</strong> {new Date(order.createdAt).toLocaleString('vi-VN')}</div>
                  <div><strong>Tổng tiền:</strong> {order.total.toLocaleString('vi-VN')}đ</div>
                  <div className="order-items-small">{order.items.length} sản phẩm</div>
                  <Link
                    to={`/account/orders/${resolveDetailRouteKey(order.code, order.id)}`}
                    className="btn-secondary"
                    style={{ textAlign: 'center' }}
                  >
                    Xem chi tiết
                  </Link>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
