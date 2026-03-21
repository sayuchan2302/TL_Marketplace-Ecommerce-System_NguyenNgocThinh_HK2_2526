import './Admin.css';
import { Link } from 'react-router-dom';
import { Package, DollarSign, AlertTriangle, Users, ArrowUpRight, ArrowDownRight, Search, Plus, Zap, Gift, RefreshCcw, Flame, Timer, ChevronRight, Boxes, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminLayout from './AdminLayout';
import { AdminStateBlock } from './AdminStateBlocks';
import { adminOrdersData } from './adminOrdersData';
import { ADMIN_ACTION_TITLES } from './adminUiLabels';
import { ADMIN_TEXT } from './adminText';
import { useMemo } from 'react';

const revenueData = [1.2, 1.5, 1.1, 1.8, 2.2, 2.0, 2.4]; // billions
const revenueLabels = ['13/03', '14/03', '15/03', '16/03', '17/03', '18/03', '19/03'];

const recentOrders = [
  { code: 'ORD-10234', customer: 'Nguyễn Văn A', total: '1.250.000 đ', status: 'Đang xử lý', waitTime: '58 phút', priority: 'high', thumb: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=120&h=140&q=80' },
  { code: 'ORD-10233', customer: 'Trần Thu B', total: '780.000 đ', status: 'Đang đóng gói', waitTime: '24 phút', priority: 'medium', thumb: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=120&h=140&q=80' },
  { code: 'ORD-10232', customer: 'Lê Hữu C', total: '2.150.000 đ', status: 'Chờ giao', waitTime: '1 giờ 12 phút', priority: 'high', thumb: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&h=140&q=80' },
  { code: 'ORD-DEMO-001', customer: 'Nguyễn Ngọc Thịnh', total: '690.000 đ', status: 'Chờ xác nhận', waitTime: '12 phút', priority: 'low', thumb: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=120&h=140&q=80' },
];

const topProducts = [
  { name: 'Áo Polo Cotton', sales: 1240, stockLeft: 16, img: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=120&h=140&q=80' },
  { name: 'Quần Jeans Slim', sales: 980, stockLeft: 8, img: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=120&h=140&q=80' },
  { name: 'Áo Thun Basic', sales: 860, stockLeft: 22, img: 'https://images.unsplash.com/photo-1475180098004-ca77a66827be?auto=format&fit=crop&w=120&h=140&q=80' },
];

const actionFeed = [
  { id: 'feed-1', tone: 'danger', text: '6 đơn trễ SLA > 2 giờ cần ưu tiên xử lý', cta: 'Mở danh sách', to: '/admin/orders', icon: <AlertTriangle size={16} /> },
  { id: 'feed-2', tone: 'warning', text: '3 SKU top seller tồn kho dưới 10', cta: 'Xem sản phẩm', to: '/admin/products', icon: <Boxes size={16} /> },
  { id: 'feed-3', tone: 'info', text: 'Campaign SUMMER20 đạt 72% quota phát hành', cta: 'Vào khuyến mãi', to: '/admin/promotions', icon: <CreditCard size={16} /> },
];

const priorityTone = (priority: string) => {
  if (priority === 'high') return 'error';
  if (priority === 'medium') return 'warning';
  return 'neutral';
};

const getPriorityLabel = (priority: string) => {
  if (priority === 'high') return ADMIN_TEXT.dashboard.recentOrders.priority.high;
  if (priority === 'medium') return ADMIN_TEXT.dashboard.recentOrders.priority.medium;
  return ADMIN_TEXT.dashboard.recentOrders.priority.low;
};

const Admin = () => {
  const { dashboard: t } = ADMIN_TEXT;
  const parseOrderMoney = (value: string) => Number(value.replace(/\D/g, '')) || 0;
  const refDay = new Date(Math.max(...adminOrdersData.map((o) => new Date(o.date).getTime())));
  const refDayKey = refDay.toLocaleDateString('vi-VN');
  const ordersInRefDay = adminOrdersData.filter((o) => new Date(o.date).toLocaleDateString('vi-VN') === refDayKey);
  const newCustomerCount = new Set(ordersInRefDay.map((o) => o.customerInfo.email.toLowerCase())).size;
  const processingCount = adminOrdersData.filter((o) => o.fulfillment === 'pending' || o.fulfillment === 'packing').length;
  const urgentCount = adminOrdersData.filter((o) => {
    if (o.fulfillment !== 'pending') return false;
    const diffMinutes = (Date.now() - new Date(o.date).getTime()) / (1000 * 60);
    return diffMinutes > 30;
  }).length;
  const paidRevenue = adminOrdersData
    .filter((o) => o.paymentStatus === 'paid' && o.fulfillment === 'done')
    .reduce((sum, o) => sum + parseOrderMoney(o.total), 0);
  const revenueDisplay = paidRevenue >= 1000000000
    ? `${(paidRevenue / 1000000000).toFixed(2)}B đ`
    : `${Math.round(paidRevenue / 1000000)}M đ`;

  const stats = useMemo(() => [
    { label: t.stats.ordersToday, value: `${ordersInRefDay.length}`, change: '+12%', tone: 'up', icon: <Package size={18} />, spark: [12, 14, 11, 16, 18, 20, 22], to: '/admin/orders' },
    { label: t.stats.revenue, value: revenueDisplay, change: '+8%', tone: 'up', icon: <DollarSign size={18} />, spark: [80, 82, 79, 85, 88, 90, 94], to: '/admin/orders?status=done' },
    { label: t.stats.pending, value: `${processingCount}`, change: '-5%', tone: 'down', icon: <AlertTriangle size={18} />, spark: [40, 42, 38, 36, 35, 37, 36], to: '/admin/orders?status=urgent' },
    { label: t.stats.newCustomers, value: `${newCustomerCount}`, change: '+3%', tone: 'up', icon: <Users size={18} />, spark: [50, 52, 51, 55, 56, 57, 58], to: '/admin/customers' },
  ], [t, ordersInRefDay.length, revenueDisplay, processingCount, newCustomerCount]);

  const quickViews = useMemo(() => [
    { label: t.quickViews.urgentOrders, count: urgentCount, to: '/admin/orders?status=urgent' },
    { label: t.quickViews.pendingOrders, count: adminOrdersData.filter((o) => o.fulfillment === 'pending').length, to: '/admin/orders?status=pending' },
    { label: t.quickViews.lowStockProducts, count: 2, to: '/admin/products?status=stock-alert' },
    { label: t.quickViews.expiringPromos, count: 1, to: '/admin/promotions?status=running' },
  ], [t, urgentCount]);

  const topSaleBase = Math.max(...topProducts.map((p) => p.sales), 1);

  return (
    <AdminLayout
      title={t.title}
      hideTopbarTitle
      actions={(
        <>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} />
          </div>
          <Link to="/admin/orders" className="admin-ghost-btn">{t.buttons.viewOrders}</Link>
          <Link to="/admin/products" className="admin-primary-btn">{t.buttons.addProduct}</Link>
        </>
      )}
    >
      <section className="admin-stats grid-4">
        {stats.map((item, idx) => (
          <motion.div
            className="admin-stat-card compact"
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.04 }}
            whileHover={{ y: -2 }}
          >
            <div className="admin-stat-header">
              <div className="admin-stat-icon">{item.icon}</div>
              <div className={`admin-stat-change ${item.tone}`}>
                {item.tone === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span>{item.change}</span>
              </div>
            </div>
            <p className="admin-stat-label">{item.label}</p>
            <Link to={item.to} className="admin-stat-link" title={`Xem chi tiết ${item.label}`}>
              <span className="admin-stat-value">{item.value}</span>
              <ChevronRight size={14} />
            </Link>
            <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
              <path
                d={`M ${item.spark.map((v, i) => `${(i / (item.spark.length - 1)) * 100} ${30 - (v / Math.max(...item.spark)) * 26}`).join(' L ')}`}
                fill="none"
                stroke={item.tone === 'up' ? '#10b981' : '#f43f5e'}
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </motion.div>
        ))}
      </section>

      <section className="dashboard-view-strip">
        {quickViews.map((view) => (
          <Link key={view.label} to={view.to} className="dashboard-view-chip">
            <span>{view.label}</span>
            <strong>{view.count}</strong>
            <ChevronRight size={14} />
          </Link>
        ))}
      </section>

      <motion.section className="admin-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.06 }}>
        <div className="admin-panel-head">
          <h2>{t.revenue.title}</h2>
          <span className="admin-muted">{t.revenue.comparison}</span>
        </div>
        <div className="area-chart-wrap">
          <svg className="area-chart" viewBox="0 0 100 50" preserveAspectRatio="none">
            <defs>
              <linearGradient id="revGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(30,58,138,0.35)" />
                <stop offset="100%" stopColor="rgba(30,58,138,0.00)" />
              </linearGradient>
            </defs>
            <path
              d={`M 0 50 L ${revenueData.map((v, i) => `${(i / (revenueData.length - 1)) * 100} ${50 - (v / Math.max(...revenueData)) * 44}`).join(' L ')} L 100 50 Z`}
              fill="url(#revGradient)"
            />
            <path
              d={`M ${revenueData.map((v, i) => `${(i / (revenueData.length - 1)) * 100} ${50 - (v / Math.max(...revenueData)) * 44}`).join(' L ')}`}
              fill="none"
              stroke="#1e3a8a"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line x1="0" y1="50" x2="100" y2="50" stroke="#e5e7eb" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2="50" stroke="#e5e7eb" strokeWidth="1" />
          </svg>
          <div className="chart-axes">
            <span>{t.revenue.axes.day}</span>
            <span>{t.revenue.axes.vnd}</span>
          </div>
          <div className="chart-x-labels">
            {revenueLabels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </motion.section>

      <div className="admin-action-bar">
        <motion.section className="admin-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.08 }}>
          <div className="admin-panel-head">
            <h2>{t.actionCenter.title}</h2>
          </div>
          <div className="action-bar-tiles">
            <Link to="/admin/products" className="action-bar-tile"><Plus size={20} /> {t.actionCenter.addProduct}</Link>
            <Link to="/admin/promotions" className="action-bar-tile"><Gift size={20} /> {t.actionCenter.createVoucher}</Link>
            <Link to="/returns" className="action-bar-tile"><RefreshCcw size={20} /> {t.actionCenter.processReturn}</Link>
            <Link to="/admin/orders" className="action-bar-tile"><Zap size={20} /> {t.actionCenter.quickProcess}</Link>
          </div>
        </motion.section>

        <motion.section className="admin-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.1 }}>
          <div className="admin-panel-head">
            <h2>{t.actionFeed.title}</h2>
          </div>
          <div className="action-bar-feed">
            {actionFeed.map((item) => (
              <Link key={item.id} to={item.to} className={`action-bar-feed-item ${item.tone}`}>
                <span className="feed-icon">{item.icon}</span>
                <div className="feed-content">
                  <p>{item.text}</p>
                  <span>{item.cta}</span>
                </div>
                <ChevronRight size={18} />
              </Link>
            ))}
          </div>
        </motion.section>
      </div>

      <motion.section className="admin-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.12 }}>
        <div className="admin-panel-head">
          <h2>{t.recentOrders.title}</h2>
          <Link to="/admin/orders">{t.recentOrders.viewAll}</Link>
        </div>
        <div className="admin-table" role="table" aria-label="Đơn hàng gần đây">
          <div className="admin-table-row admin-table-head recent-v2" role="row">
            <div role="columnheader">{t.recentOrders.columns.order}</div>
            <div role="columnheader">{t.recentOrders.columns.priority}</div>
            <div role="columnheader">{t.recentOrders.columns.waitTime}</div>
            <div role="columnheader">{t.recentOrders.columns.total}</div>
            <div role="columnheader">{t.recentOrders.columns.actions}</div>
          </div>
          {recentOrders.length === 0 ? (
            <div role="row">
              <AdminStateBlock type="empty" title={t.recentOrders.empty.title} description={t.recentOrders.empty.description} />
            </div>
          ) : recentOrders.map((order, idx) => (
            <motion.div
              className="admin-table-row recent-v2 recent-order-row"
              role="row"
              key={order.code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: 0.12 + idx * 0.03 }}
              whileHover={{ y: -1 }}
            >
              <div role="cell" className="admin-customer">
                <img src={order.thumb} alt={order.customer} />
                <div>
                  <p className="admin-bold">{order.code}</p>
                  <span>{order.customer}</span>
                </div>
              </div>
              <div role="cell"><span className={`admin-pill ${priorityTone(order.priority)}`}>{getPriorityLabel(order.priority)}</span></div>
              <div role="cell" className="wait-time-cell"><Timer size={14} /> {order.waitTime}</div>
              <div role="cell">{order.total}</div>
              <div role="cell" className="admin-actions compact">
                <button className={`admin-ghost-btn small ${order.priority === 'high' ? 'primary-cta' : ''}`}>{t.recentOrders.confirm}</button>
                <Link to={`/admin/orders/${order.code}`} className="admin-icon-btn" aria-label={ADMIN_ACTION_TITLES.viewDetail}>
                  <ChevronRight size={15} />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      <motion.section className="admin-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 0.14 }}>
        <div className="admin-panel-head">
          <h2>{t.topProducts.title}</h2>
        </div>
        <div className="top-products">
          {topProducts.length === 0 ? (
            <AdminStateBlock type="empty" title={t.topProducts.empty.title} description={t.topProducts.empty.description} />
          ) : topProducts.map((p, idx) => (
            <motion.div key={p.name} className="top-product" whileHover={{ y: -2 }}>
              <div className="top-rank">Top {idx + 1}</div>
              <img src={p.img} alt={p.name} />
              <div className="top-product-meta">
                <p className="admin-bold">{p.name}</p>
                <p className="admin-muted"><Flame size={13} /> {p.sales} {t.topProducts.sales}</p>
                <div className="top-product-bar"><span className={p.stockLeft < 10 ? 'low-stock' : ''} style={{ width: `${Math.round((p.sales / topSaleBase) * 100)}%` }} /></div>
                <p className={`admin-muted stock-note ${p.stockLeft < 10 ? 'low' : ''}`}>{t.topProducts.stockLeft} {p.stockLeft}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </AdminLayout>
  );
};

export default Admin;
