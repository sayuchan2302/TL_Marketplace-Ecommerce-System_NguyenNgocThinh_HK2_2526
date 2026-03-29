import './Admin.css';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronRight,
  DollarSign,
  FolderTree,
  Package,
  ShieldAlert,
  Sparkles,
  Store,
  TicketPercent,
  Users,
  WalletCards,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import AdminLayout from './AdminLayout';
import { AdminStateBlock } from './AdminStateBlocks';
import {
  adminDashboardService,
  type AdminDashboardParentOrder,
  type AdminDashboardTopCategory,
} from '../../services/adminDashboardService';
import {
  resolveDetailRouteKey,
  toDisplayOrderCode,
} from '../../utils/displayCode';

const formatCurrency = (value: number) => `${(value || 0).toLocaleString('vi-VN')} ₫`;

const formatShortDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
};

const formatWaitTime = (minutes: number) => {
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (remainder === 0) {
      return `${hours} giờ`;
    }
    return `${hours} giờ ${remainder} phút`;
  }
  return `${minutes} phút`;
};

const priorityTone = (priority: string) => {
  if (priority === 'high') return 'error';
  if (priority === 'medium') return 'warning';
  return 'neutral';
};

const priorityLabel = (priority: string) => {
  if (priority === 'high') return 'Quan trọng';
  if (priority === 'medium') return 'Chú ý';
  return 'Theo dõi';
};

const buildSparkFromTrend = (series: number[]) => {
  if (series.length === 0) {
    return [1, 1, 1, 1, 1, 1, 1];
  }
  return series.map((value) => Math.max(1, value));
};

const Admin = () => {
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof adminDashboardService.get>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await adminDashboardService.get();
      setDashboard(data);
    } catch (error: unknown) {
      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Không thể tải dữ liệu dashboard.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const trendSeries = useMemo(() => {
    const trend = dashboard?.trend || [];
    return {
      gmv: trend.map((point) => Number(point.gmv || 0)),
      commission: trend.map((point) => Number(point.commission || 0)),
      labels: trend.map((point) => formatShortDate(point.date)),
    };
  }, [dashboard?.trend]);

  const stats = useMemo(() => {
    const metrics = dashboard?.metrics;
    const gmvSpark = buildSparkFromTrend(trendSeries.gmv);
    const commissionSpark = buildSparkFromTrend(trendSeries.commission);
    return [
      {
        label: 'GMV đã giao thành công',
        value: formatCurrency(Number(metrics?.gmvDelivered || 0)),
        change: 'Live',
        icon: <DollarSign size={18} />,
        to: '/admin/financials',
        spark: gmvSpark,
      },
      {
        label: 'Commission đã ghi nhận',
        value: formatCurrency(Number(metrics?.commissionDelivered || 0)),
        change: 'Live',
        icon: <WalletCards size={18} />,
        to: '/admin/financials',
        spark: commissionSpark,
      },
      {
        label: 'Đơn hàng toàn sàn',
        value: String(metrics?.totalOrders || 0),
        change: 'Live',
        icon: <Package size={18} />,
        to: '/admin/orders',
        spark: gmvSpark,
      },
      {
        label: 'Chờ duyệt vendor',
        value: String(metrics?.pendingStoreApprovals || 0),
        change: 'Live',
        icon: <Store size={18} />,
        to: '/admin/stores',
        spark: gmvSpark,
      },
      {
        label: 'Tài khoản bị khóa',
        value: String(metrics?.lockedUsers || 0),
        change: 'Live',
        icon: <Users size={18} />,
        to: '/admin/users',
        spark: commissionSpark,
      },
      {
        label: 'Chiến dịch đang chạy',
        value: String(metrics?.runningCampaigns || 0),
        change: 'Live',
        icon: <TicketPercent size={18} />,
        to: '/admin/promotions',
        spark: commissionSpark,
      },
    ];
  }, [dashboard?.metrics, trendSeries.commission, trendSeries.gmv]);

  const quickViews = useMemo(() => {
    const quick = dashboard?.quickViews;
    return [
      { label: 'Vendor onboarding chờ duyệt', count: quick?.pendingStoreApprovals || 0, to: '/admin/stores' },
      { label: 'Danh mục cần kiểm tra', count: quick?.categoriesNeedReview || 0, to: '/admin/categories' },
      { label: 'Đơn hàng cha cần xử lý', count: quick?.parentOrdersNeedAttention || 0, to: '/admin/orders' },
      { label: 'Yêu cầu đổi trả chờ xử lý', count: quick?.pendingReturns || 0, to: '/admin/returns' },
    ];
  }, [dashboard?.quickViews]);

  const governanceFeed = useMemo(() => {
    const quick = dashboard?.quickViews;
    return [
      {
        id: 'gov-1',
        tone: (quick?.parentOrdersNeedAttention || 0) > 0 ? 'danger' : 'info',
        text: `${quick?.parentOrdersNeedAttention || 0} đơn hàng cha cần theo dõi SLA`,
        cta: 'Mở đơn hàng cha',
        to: '/admin/orders',
        icon: <ShieldAlert size={16} />,
      },
      {
        id: 'gov-2',
        tone: (quick?.pendingStoreApprovals || 0) > 0 ? 'warning' : 'info',
        text: `${quick?.pendingStoreApprovals || 0} gian hàng mới đang chờ duyệt`,
        cta: 'Duyệt gian hàng',
        to: '/admin/stores',
        icon: <Store size={16} />,
      },
      {
        id: 'gov-3',
        tone: (quick?.pendingReturns || 0) > 0 ? 'warning' : 'info',
        text: `${quick?.pendingReturns || 0} yêu cầu đổi trả cần điều phối`,
        cta: 'Xem đổi trả',
        to: '/admin/returns',
        icon: <WalletCards size={16} />,
      },
    ];
  }, [dashboard?.quickViews]);

  const parentOrders: AdminDashboardParentOrder[] = dashboard?.parentOrders || [];
  const topCategories: AdminDashboardTopCategory[] = dashboard?.topCategories || [];
  const topSignalBase = Math.max(...topCategories.map((item) => item.productCount), 1);
  const trendMax = Math.max(...trendSeries.gmv, 1);

  if (isLoading && !dashboard) {
    return (
      <AdminLayout title="Tổng quan">
        <div className="admin-loading" style={{ padding: '3rem', textAlign: 'center' }}>
          Đang tải dashboard quản trị...
        </div>
      </AdminLayout>
    );
  }

  if (loadError && !dashboard) {
    return (
      <AdminLayout title="Tổng quan">
        <AdminStateBlock
          type="error"
          title="Không thể tải dashboard"
          description={loadError}
          actionLabel="Thử lại"
          onAction={loadDashboard}
        />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Tổng quan"
      actions={(
        <>
          <Link to="/admin/stores" className="admin-ghost-btn">Duyệt gian hàng</Link>
          <Link to="/admin/categories" className="admin-primary-btn">Quản lý danh mục</Link>
        </>
      )}
    >
      <section className="admin-stats grid-6">
        {stats.map((item) => (
          <motion.div
            className="admin-stat-card compact"
            key={item.label}
            whileHover={{ y: -2 }}
          >
            <div className="admin-stat-header">
              <div className="admin-stat-icon">{item.icon}</div>
              <div className="admin-stat-change up">
                <ArrowUpRight size={14} />
                <span>{item.change}</span>
              </div>
            </div>
            <p className="admin-stat-label">{item.label}</p>
            <Link to={item.to} className="admin-stat-link" title={`Xem ${item.label}`}>
              <span className="admin-stat-value">{item.value}</span>
              <ChevronRight size={14} />
            </Link>
            <svg className="sparkline" viewBox="0 0 100 30" preserveAspectRatio="none">
              <path
                d={`M ${item.spark
                  .map((v, i) => `${(i / (item.spark.length - 1)) * 100} ${30 - (v / Math.max(...item.spark, 1)) * 26}`)
                  .join(' L ')}`}
                fill="none"
                stroke="#3b82f6"
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

      <motion.section className="admin-panel">
        <div className="admin-panel-head">
          <h2>GMV 7 ngày gần nhất</h2>
          <span className="admin-muted">Dữ liệu đồng bộ theo backend</span>
        </div>
        <div className="area-chart-wrap">
          <svg className="area-chart" viewBox="0 0 100 50" preserveAspectRatio="none">
            <defs>
              <linearGradient id="marketGmvGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(15,23,42,0.30)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.00)" />
              </linearGradient>
            </defs>
            <path
              d={`M 0 50 L ${trendSeries.gmv
                .map((v, i) => `${(i / Math.max(trendSeries.gmv.length - 1, 1)) * 100} ${50 - (v / trendMax) * 44}`)
                .join(' L ')} L 100 50 Z`}
              fill="url(#marketGmvGradient)"
            />
            <path
              d={`M ${trendSeries.gmv
                .map((v, i) => `${(i / Math.max(trendSeries.gmv.length - 1, 1)) * 100} ${50 - (v / trendMax) * 44}`)
                .join(' L ')}`}
              fill="none"
              stroke="#0f172a"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <line x1="0" y1="50" x2="100" y2="50" stroke="#e5e7eb" strokeWidth="1" />
            <line x1="0" y1="0" x2="0" y2="50" stroke="#e5e7eb" strokeWidth="1" />
          </svg>
          <div className="chart-axes">
            <span>Ngày</span>
            <span>GMV</span>
          </div>
          <div className="chart-x-labels">
            {trendSeries.labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        </div>
      </motion.section>

      <div className="admin-action-bar">
        <motion.section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Hành động của quản trị viên</h2>
          </div>
          <div className="action-bar-tiles">
            <Link to="/admin/stores" className="action-bar-tile"><Zap size={20} /> Duyệt vendor</Link>
            <Link to="/admin/promotions" className="action-bar-tile"><TicketPercent size={20} /> Tạo mega sale</Link>
            <Link to="/admin/categories" className="action-bar-tile"><FolderTree size={20} /> Quản lý danh mục</Link>
            <Link to="/admin/bot-ai" className="action-bar-tile"><Sparkles size={20} /> Bot, FAQ và AI</Link>
          </div>
        </motion.section>

        <motion.section className="admin-panel">
          <div className="admin-panel-head">
            <h2>Nguồn cấp dữ liệu quản trị</h2>
          </div>
          <div className="action-bar-feed">
            {governanceFeed.map((item) => (
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

      <motion.section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Đơn hàng cha cần xử lý</h2>
          <Link to="/admin/orders">Mở tất cả</Link>
        </div>
        {parentOrders.length === 0 ? (
          <AdminStateBlock
            type="empty"
            title="Không có đơn hàng cha đang chờ"
            description="Các đơn hàng cha cần theo dõi SLA sẽ xuất hiện tại đây."
          />
        ) : (
          <div className="admin-table" role="table" aria-label="Đơn hàng cha cần xử lý">
            <div className="admin-table-row admin-table-head recent-v2" role="row">
              <div role="columnheader">Đơn hàng cha</div>
              <div role="columnheader">Mức độ</div>
              <div role="columnheader">Chờ xử lý</div>
              <div role="columnheader">Tổng giá trị</div>
              <div role="columnheader">Hành động</div>
            </div>
            {parentOrders.map((order) => (
              <motion.div
                className="admin-table-row recent-v2 recent-order-row"
                role="row"
                key={order.id}
                whileHover={{ y: -1 }}
              >
                <div role="cell" className="admin-customer">
                  <img
                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(order.customerName)}&background=0EA5E9&color=fff`}
                    alt={order.customerName}
                  />
                  <div>
                    <p className="admin-bold">{toDisplayOrderCode(order.code)}</p>
                    <span>{order.customerName}</span>
                  </div>
                </div>
                <div role="cell"><span className={`admin-pill ${priorityTone(order.priority)}`}>{priorityLabel(order.priority)}</span></div>
                <div role="cell" className="wait-time-cell">{formatWaitTime(order.waitMinutes)}</div>
                <div role="cell">{formatCurrency(order.total)}</div>
                <div role="cell" className="admin-actions compact">
                  <button className={`admin-ghost-btn small ${order.priority === 'high' ? 'primary-cta' : ''}`}>{order.issue}</button>
                  <Link to={`/admin/orders/${resolveDetailRouteKey(order.code, order.id)}`} className="admin-icon-btn" aria-label="Xem chi tiết">
                    <ChevronRight size={15} />
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      <motion.section className="admin-panel">
        <div className="admin-panel-head">
          <h2>Danh mục dẫn đầu hệ thống</h2>
          <Link to="/admin/categories">Mở danh mục</Link>
        </div>
        {topCategories.length === 0 ? (
          <AdminStateBlock
            type="empty"
            title="Chưa có dữ liệu danh mục nổi bật"
            description="Khi danh mục có đủ dữ liệu sản phẩm hoạt động, bảng xếp hạng sẽ hiển thị tại đây."
          />
        ) : (
          <div className="top-products">
            {topCategories.map((item, idx) => (
              <motion.div key={item.categoryId} className="top-product" whileHover={{ y: -2 }}>
                <div className="top-rank">Top {idx + 1}</div>
                <div className="top-product-meta">
                  <p className="admin-bold">{item.name}</p>
                  <p className="admin-muted">{item.signal}</p>
                  <div className="top-product-bar">
                    <span style={{ width: `${Math.round((item.productCount / topSignalBase) * 100)}%` }} />
                  </div>
                  <p className="admin-muted stock-note">{item.productCount} sản phẩm active</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>
    </AdminLayout>
  );
};

export default Admin;
