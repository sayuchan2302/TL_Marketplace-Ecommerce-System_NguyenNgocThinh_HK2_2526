import './Admin.css';
import { Link } from 'react-router-dom';
import { Filter, Search, CheckCircle, Clock3, XCircle } from 'lucide-react';

const orders = [
  { code: 'DH-10234', customer: 'Nguyễn Văn A', total: '1.250.000 đ', status: 'Đã thanh toán', channel: 'Web', date: '2026-03-10' },
  { code: 'DH-10233', customer: 'Trần Thu B', total: '780.000 đ', status: 'Chờ xử lý', channel: 'App', date: '2026-03-10' },
  { code: 'DH-10232', customer: 'Lê Hữu C', total: '2.150.000 đ', status: 'Đang giao', channel: 'Web', date: '2026-03-09' },
  { code: 'DH-10231', customer: 'Phạm Hương', total: '560.000 đ', status: 'Hoàn tất', channel: 'CSKH', date: '2026-03-09' },
];

const statusTone = (status: string) => {
  if (status.toLowerCase().includes('đang') || status.toLowerCase().includes('chờ')) return 'pending';
  if (status.toLowerCase().includes('hoàn') || status.toLowerCase().includes('đã thanh toán')) return 'success';
  return 'neutral';
};

const AdminOrders = () => {
  return (
    <div className="admin-main standalone">
      <header className="admin-topbar">
        <h1>Đơn hàng</h1>
        <div className="admin-topbar-actions">
          <div className="admin-search">
            <Search size={16} />
            <input placeholder="Tìm mã đơn, khách hàng..." />
          </div>
          <button className="admin-ghost-btn"><Filter size={16} /> Bộ lọc</button>
        </div>
      </header>

      <div className="admin-table" role="table" aria-label="Danh sách đơn hàng">
        <div className="admin-table-row admin-table-head wide" role="row">
          <div role="columnheader">Mã đơn</div>
          <div role="columnheader">Khách</div>
          <div role="columnheader">Tổng</div>
          <div role="columnheader">Trạng thái</div>
          <div role="columnheader">Kênh</div>
          <div role="columnheader">Ngày</div>
          <div role="columnheader">Chi tiết</div>
        </div>
        {orders.map(order => (
          <div className="admin-table-row wide" role="row" key={order.code}>
            <div role="cell" className="admin-bold">{order.code}</div>
            <div role="cell">{order.customer}</div>
            <div role="cell">{order.total}</div>
            <div role="cell">
              <span className={`admin-pill ${statusTone(order.status)}`}>
                {order.status}
              </span>
            </div>
            <div role="cell" className="admin-muted">{order.channel}</div>
            <div role="cell" className="admin-muted">{order.date}</div>
            <div role="cell">
              <Link to={`/account/orders/${order.code}`} className="admin-link">Xem</Link>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-hint">
        <p>Để xử lý đơn: chọn đơn trong danh sách, kiểm tra thanh toán, in phiếu, cập nhật trạng thái giao hàng.</p>
        <div className="admin-hint-pills">
          <span className="admin-pill success"><CheckCircle size={14} /> Đã thanh toán</span>
          <span className="admin-pill pending"><Clock3 size={14} /> Chờ xử lý</span>
          <span className="admin-pill neutral"><XCircle size={14} /> Hủy</span>
        </div>
      </div>
    </div>
  );
};

export default AdminOrders;
