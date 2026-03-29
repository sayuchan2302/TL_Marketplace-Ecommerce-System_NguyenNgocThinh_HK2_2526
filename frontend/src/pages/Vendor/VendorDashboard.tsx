import './Vendor.css';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  Clock,
  DollarSign,
  Flame,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Store,
  TicketPercent,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { startTransition, useEffect, useState } from 'react';
import VendorLayout from './VendorLayout';
import { getVendorOrderStatusLabel, getVendorOrderStatusTone } from './vendorOrderPresentation';
import { calculateCommission, formatCurrency } from '../../services/commissionService';
import { vendorPortalService, type VendorDashboardData, type VendorOrderSummary } from '../../services/vendorPortalService';
import { vendorVoucherService } from '../../services/vendorVoucherService';
import { useToast } from '../../contexts/ToastContext';
import { getUiErrorMessage } from '../../utils/errorMessage';
import { AdminStateBlock } from '../Admin/AdminStateBlocks';
import {
  resolveDetailRouteKey,
  toDisplayOrderCode,
} from '../../utils/displayCode';

const initialData: VendorDashboardData = {
  stats: {
    todayOrders: 0,
    pendingOrders: 0,
    totalRevenue: 0,
    totalPayout: 0,
    totalProducts: 0,
    rating: 0,
    commissionRate: 5,
  },
  recentOrders: [],
  topProducts: [],
};

const VendorDashboard = () => {
  const { addToast } = useToast();
  const [data, setData] = useState<VendorDashboardData>(initialData);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [runningVoucherCount, setRunningVoucherCount] = useState(0);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      try {
        setLoadError('');
        const [next, voucherResult] = await Promise.all([
          vendorPortalService.getDashboardData(),
          vendorVoucherService.list({ status: 'running', page: 1, size: 1 }),
        ]);
        if (!active) return;
        startTransition(() => {
          setData(next);
          setRunningVoucherCount(voucherResult.counts.running);
        });
      } catch (err: unknown) {
        if (!active) return;
        const message = getUiErrorMessage(err, 'Không tải được bảng điều khiển gian hàng');
        setLoadError(message);
        setData(initialData);
        setRunningVoucherCount(0);
        addToast(message, 'error');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      active = false;
    };
  }, [addToast, reloadKey]);

  const stats = data.stats;
  const topSaleBase = Math.max(...data.topProducts.map((product) => product.sales), 1);

  const statCards = [
    {
      label: 'Đơn mới hôm nay',
      value: stats.todayOrders,
      change: `${stats.todayOrders > 0 ? '+' : ''}${stats.todayOrders}`,
      tone: stats.todayOrders > 0 ? 'up' : 'down',
      icon: <ShoppingCart size={18} />,
      to: '/vendor/orders',
    },
    {
      label: 'Chờ xác nhận',
      value: stats.pendingOrders,
      change: `${stats.pendingOrders > 0 ? '+' : ''}${stats.pendingOrders}`,
      tone: stats.pendingOrders > 0 ? 'up' : 'down',
      icon: <Clock size={18} />,
      to: '/vendor/orders?status=pending',
      cardTone: stats.pendingOrders > 0 ? 'warning' : undefined,
    },
    {
      label: 'Doanh thu gộp',
      value: formatCurrency(stats.totalRevenue),
      change: `${stats.totalRevenue > 0 ? '+' : ''}${Math.round(stats.totalRevenue / 1000000)}M`,
      tone: stats.totalRevenue > 0 ? 'up' : 'down',
      icon: <DollarSign size={18} />,
      to: '/vendor/analytics',
    },
    {
      label: 'Tiền thực nhận',
      value: formatCurrency(stats.totalPayout),
      change: `${stats.totalPayout > 0 ? '+' : ''}${Math.round(stats.totalPayout / 1000000)}M`,
      tone: stats.totalPayout > 0 ? 'up' : 'down',
      icon: <BarChart3 size={18} />,
      to: '/vendor/analytics',
      cardTone: 'teal',
    },
    {
      label: 'Sản phẩm đang bán',
      value: stats.totalProducts,
      change: `${stats.totalProducts > 0 ? '+' : ''}${stats.totalProducts}`,
      tone: stats.totalProducts > 0 ? 'up' : 'down',
      icon: <Package size={18} />,
      to: '/vendor/products',
    },
    {
      label: 'Voucher đang chạy',
      value: runningVoucherCount,
      change: `${runningVoucherCount}`,
      tone: runningVoucherCount > 0 ? 'up' : 'down',
      icon: <TicketPercent size={18} />,
      to: '/vendor/promotions',
      cardTone: 'success',
    },
  ];

  const quickActions = [
    { label: 'Thêm sản phẩm', icon: <Plus size={18} />, to: '/vendor/products?action=add' },
    { label: 'Xử lý đơn hàng con', icon: <ShoppingCart size={18} />, to: '/vendor/orders' },
    { label: 'Trang trí gian hàng', icon: <Store size={18} />, to: '/vendor/storefront' },
    { label: 'Xem đối soát', icon: <BarChart3 size={18} />, to: '/vendor/analytics' },
    { label: 'Cài đặt vận hành', icon: <Settings size={18} />, to: '/vendor/settings' },
  ];

  const handleConfirmOrder = async (order: VendorOrderSummary) => {
    setUpdatingId(order.id);
    await vendorPortalService.updateOrderStatus(order.id, 'CONFIRMED');
    startTransition(() => {
      setData((current) => ({
        ...current,
        recentOrders: current.recentOrders.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: 'confirmed',
              }
            : item,
        ),
      }));
    });
    setUpdatingId(null);
    addToast('Đã cập nhật trạng thái đơn hàng con', 'success');
  };

  return (
    <VendorLayout
      title="Dashboard"
      breadcrumbs={['Kênh Người Bán', 'Tổng quan']}
      actions={(
        <>
          <Link to="/vendor/storefront" className="vendor-ghost-btn">Gian hàng công khai</Link>
          <Link to="/vendor/products?action=add" className="vendor-primary-btn">
            <Plus size={16} style={{ marginRight: 6 }} />
            Thêm sản phẩm
          </Link>
        </>
      )}
    >
      {loadError ? (
        <section className="admin-panels single">
          <AdminStateBlock
            type="error"
            title="Không tải được dữ liệu tổng quan"
            description={loadError}
            actionLabel="Thử lại"
            onAction={() => setReloadKey((key) => key + 1)}
          />
        </section>
      ) : null}
      <section className="vendor-stats grid-6">
        {statCards.map((item, idx) => (
          <motion.div
            className={`vendor-stat-card compact ${item.cardTone || ''}`}
            key={item.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: idx * 0.03 }}
            whileHover={{ y: -2 }}
          >
            <div className="vendor-stat-header">
              <div className="vendor-stat-icon">{item.icon}</div>
              <div className={`vendor-stat-change ${item.tone}`}>
                {item.tone === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                <span>{item.change}</span>
              </div>
            </div>
            <p className="vendor-stat-label">{item.label}</p>
            <Link to={item.to} className="vendor-stat-link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none' }}>
              <span className="vendor-stat-value">{item.value}</span>
              <ChevronRight size={14} style={{ color: '#94a3b8' }} />
            </Link>
          </motion.div>
        ))}
      </section>

      <motion.section
        className="commission-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.15 }}
        style={{ marginBottom: 16 }}
      >
        <h3>Tổng quan thực nhận: hoa hồng {stats.commissionRate}%</h3>
        <div className="commission-row">
          <span className="label">GMV lũy kế (đơn giao thành công)</span>
          <span className="value">{formatCurrency(stats.totalRevenue)}</span>
        </div>
        <div className="commission-row">
          <span className="label">Phí sàn ({stats.commissionRate}%)</span>
          <span className="value" style={{ color: '#d97706' }}>
            -{formatCurrency(calculateCommission(stats.totalRevenue, stats.commissionRate).commission)}
          </span>
        </div>
        <div className="commission-divider" />
        <div className="commission-row total">
          <span className="label">Thực nhận dự kiến</span>
          <span className="value">{formatCurrency(calculateCommission(stats.totalRevenue, stats.commissionRate).payout)}</span>
        </div>
      </motion.section>

      <motion.section
        className="vendor-panel"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, delay: 0.18 }}
        style={{ marginBottom: 16 }}
      >
        <div className="vendor-panel-head">
          <h2>Thao tác nhanh cho chủ shop</h2>
        </div>
        <div className="vendor-quick-actions">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.to} className="vendor-action-tile">
              {action.icon}
              {action.label}
            </Link>
          ))}
        </div>
      </motion.section>

      <div className="vendor-panels">
        <motion.section
          className="vendor-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.2 }}
        >
          <div className="vendor-panel-head">
            <h2>Đơn hàng mới cần xử lý</h2>
            <Link to="/vendor/orders">Xem tất cả</Link>
          </div>

          {loading ? (
            <div className="vendor-state-block">
              <div className="vendor-state-icon"><Clock size={20} /></div>
              <h3>Đang đồng bộ dữ liệu</h3>
              <p>Đơn hàng và số liệu đối soát đang được cập nhật từ hệ thống.</p>
            </div>
          ) : data.recentOrders.length === 0 ? (
            <div className="vendor-state-block">
              <div className="vendor-state-icon"><Package size={20} /></div>
              <h3>Chưa có đơn hàng con nào</h3>
              <p>Khi shop nhận được đơn mới, danh sách sẽ hiển thị tại đây để xử lý.</p>
            </div>
          ) : (
            <div className="vendor-table" role="table">
              <div className="vendor-table-row vendor-table-head orders" role="row">
                <div role="columnheader">Đơn hàng</div>
                <div role="columnheader">Khách hàng</div>
                <div role="columnheader">Tổng tiền</div>
                <div role="columnheader">Phí sàn</div>
                <div role="columnheader">Thực nhận</div>
                <div role="columnheader">Trạng thái</div>
                <div role="columnheader">Hành động</div>
              </div>
              {data.recentOrders.map((order, idx) => (
                <motion.div
                  className="vendor-table-row orders"
                  role="row"
                  key={order.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: 0.22 + idx * 0.03 }}
                >
                  <div role="cell" style={{ fontWeight: 700 }}>{toDisplayOrderCode(order.code)}</div>
                  <div role="cell">{order.customer}</div>
                  <div role="cell" style={{ fontWeight: 700 }}>{formatCurrency(order.total)}</div>
                  <div role="cell" style={{ color: '#d97706', fontSize: 13 }}>-{formatCurrency(order.commissionFee)}</div>
                  <div role="cell" style={{ color: '#0d9488', fontWeight: 700 }}>{formatCurrency(order.vendorPayout)}</div>
                  <div role="cell">
                    <span className={`vendor-pill ${getVendorOrderStatusTone(order.status)}`}>
                      {getVendorOrderStatusLabel(order.status)}
                    </span>
                  </div>
                  <div role="cell" className="vendor-actions">
                    {order.status === 'pending' && (
                      <button
                        className="vendor-primary-btn"
                        style={{ padding: '6px 12px', fontSize: 12 }}
                        onClick={() => handleConfirmOrder(order)}
                        disabled={updatingId === order.id}
                      >
                        {updatingId === order.id ? 'Đang xử lý...' : 'Xác nhận đơn'}
                      </button>
                    )}
                    <Link to={`/vendor/orders/${resolveDetailRouteKey(order.code, order.id)}`} className="vendor-icon-btn subtle" aria-label="Xem chi tiết">
                      <ChevronRight size={15} />
                    </Link>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>

        <motion.section
          className="vendor-panel"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, delay: 0.24 }}
        >
          <div className="vendor-panel-head">
            <h2>Top sản phẩm của shop</h2>
            <Link to="/vendor/products">Xem tất cả</Link>
          </div>

          {data.topProducts.length === 0 ? (
            <div className="vendor-state-block">
              <div className="vendor-state-icon"><BarChart3 size={20} /></div>
              <h3>Chưa có dữ liệu hiệu suất</h3>
              <p>Sản phẩm bán chạy sẽ hiển thị tại đây khi shop có dữ liệu đơn hàng.</p>
            </div>
          ) : (
            <div className="vendor-top-products">
              {data.topProducts.map((product, idx) => (
                <motion.div
                  key={product.id}
                  className="vendor-top-product"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: 0.26 + idx * 0.04 }}
                >
                  <img src={product.img} alt={product.name} />
                  <div className="vendor-top-product-meta">
                    <span className="name">{product.name}</span>
                    <span className="stats">
                      <Flame size={13} /> {product.sales} đã bán
                      <span style={{ marginLeft: 8 }}>{formatCurrency(product.revenue)}</span>
                    </span>
                    <div className="vendor-top-product-bar">
                      <span style={{ width: `${Math.round((product.sales / topSaleBase) * 100)}%` }} />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.section>
      </div>
    </VendorLayout>
  );
};

export default VendorDashboard;
