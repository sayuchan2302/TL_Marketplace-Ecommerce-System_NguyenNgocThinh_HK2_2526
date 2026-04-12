import './Admin.css';
import { Link } from 'react-router-dom';
import { Eye, Printer } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import AdminLayout from './AdminLayout';
import { AdminStateBlock } from './AdminStateBlocks';
import { useAdminListState } from './useAdminListState';
import {
  listAdminOrders,
  subscribeAdminOrders,
  type AdminOrderRecord,
} from './adminOrderService';
import { useAdminToast } from './useAdminToast';
import { ADMIN_DICTIONARY } from './adminDictionary';
import {
  paymentLabel,
  shipLabel,
  type FulfillmentStatus,
  type PaymentStatus,
} from './orderWorkflow';
import { PanelStatsGrid, PanelTabs } from '../../components/Panel/PanelPrimitives';
import { getUiErrorMessage } from '../../utils/errorMessage';
import {
  resolveDetailRouteKey,
  toDisplayOrderCode,
} from '../../utils/displayCode';

interface AdminOrderRow {
  id: string;
  code: string;
  customer: string;
  email: string;
  phone: string;
  avatar: string;
  productName: string;
  productMeta: string;
  productExtra: string | null;
  total: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  fulfillment: FulfillmentStatus;
  date: string;
}

const mapOrderRecordToRow = (order: AdminOrderRecord): AdminOrderRow => {
  const firstItem = order.items[0];
  const productMeta = [
    firstItem?.size ? `Size ${firstItem.size}` : null,
    firstItem?.color ? `Màu ${firstItem.color}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return {
    id: String(order.id || ''),
    code: order.code || '',
    customer: order.customer,
    email: order.customerInfo.email,
    phone: order.customerInfo.phone,
    avatar: order.avatar,
    productName: firstItem?.name || 'Chưa có sản phẩm',
    productMeta: productMeta || 'Chưa có biến thể',
    productExtra: order.items.length > 1 ? `+${order.items.length - 1} sản phẩm khác` : null,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    fulfillment: order.fulfillment,
    date: order.date,
  };
};

const toTimestamp = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const displayOrderCode = (code: string) => toDisplayOrderCode(code);

const formatPaymentMethod = (method: string) => {
  const normalized = (method || '').trim().toUpperCase();
  switch (normalized) {
    case 'COD':
      return 'COD';
    case 'VNPAY':
      return 'VNPay';
    case 'MOMO':
      return 'MoMo';
    case 'ZALOPAY':
      return 'ZaloPay';
    case 'BANK_TRANSFER':
      return 'Chuyen khoan';
    default:
      return normalized || 'N/A';
  }
};

const paymentMethodPillClass = (method: string) => {
  const normalized = (method || '').trim().toUpperCase();
  if (normalized === 'MOMO') return 'payment-momo';
  if (normalized === 'VNPAY') return 'payment-vnpay';
  return 'neutral';
};

const tabs = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ tiếp nhận' },
  { key: 'packing', label: 'Đang đóng gói' },
  { key: 'shipping', label: 'Đang vận chuyển' },
  { key: 'done', label: 'Hoàn tất' },
  { key: 'canceled', label: 'Đã hủy' },
];

const AdminOrders = () => {
  const c = ADMIN_DICTIONARY.common;
  const actions = ADMIN_DICTIONARY.actions;
  const actionTitles = ADMIN_DICTIONARY.actionTitles;
  const aria = useMemo(() => c.aria, [c.aria]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<AdminOrderRow[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, pushToast } = useAdminToast();

  const getSearchText = useCallback(
    (row: AdminOrderRow) =>
      `${displayOrderCode(row.code)} ${row.customer} ${row.email} ${row.phone} ${row.productName} ${row.productMeta} ${formatPaymentMethod(row.paymentMethod)} ${paymentLabel(row.paymentStatus)} ${shipLabel(row.fulfillment)}`,
    [],
  );

  const filterPredicate = useCallback(
    (row: AdminOrderRow) => {
      if (activeTab === 'all') return true;
      return row.fulfillment === activeTab;
    },
    [activeTab],
  );

  const {
    isLoading,
    filteredItems: filteredOrders,
    pagedItems: pagedOrders,
    totalPages,
    startIndex,
    endIndex,
  } = useAdminListState<AdminOrderRow>({
    items: rows,
    pageSize: 6,
    searchValue: search,
    onSearchChange: setSearch,
    pageValue: page,
    onPageChange: setPage,
    getSearchText,
    filterPredicate,
    loadingDeps: [activeTab],
  });

  const fetchOrders = useCallback(async () => {
    setLoadError(null);
    try {
      const records = await listAdminOrders();
      const mapped = records
        .map(mapOrderRecordToRow)
        .sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date));
      setRows(mapped);
    } catch (error: unknown) {
      setRows([]);
      setLoadError(getUiErrorMessage(error, 'Không thể tải danh sách đơn hàng từ backend.'));
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
    const unsubscribe = subscribeAdminOrders(fetchOrders);
    return unsubscribe;
  }, [fetchOrders]);

  const resetCurrentView = () => {
    setSelected(new Set());
    setActiveTab('all');
    setSearch('');
    setPage(1);
    pushToast('Đã đặt lại danh sách đơn hàng.');
  };

  const tabCounts = {
    all: rows.length,
    pending: rows.filter((row) => row.fulfillment === 'pending').length,
    packing: rows.filter((row) => row.fulfillment === 'packing').length,
    shipping: rows.filter((row) => row.fulfillment === 'shipping').length,
    done: rows.filter((row) => row.fulfillment === 'done').length,
    canceled: rows.filter((row) => row.fulfillment === 'canceled').length,
  } as const;

  const changeTab = (nextTab: string) => {
    setSelected(new Set());
    setActiveTab(nextTab);
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(filteredOrders.map((row) => row.id)));
      return;
    }
    setSelected(new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    const nextSelection = new Set(selected);
    if (checked) {
      nextSelection.add(id);
    } else {
      nextSelection.delete(id);
    }
    setSelected(nextSelection);
  };

  return (
    <AdminLayout
      title="Đơn hàng"
      breadcrumbs={['Đơn hàng', 'Toàn cảnh điều hành']}
    >
      <PanelStatsGrid
        items={[
          {
            key: 'all',
            label: 'Tổng đơn hàng',
            value: tabCounts.all,
            sub: 'Toàn bộ đơn hàng đang được theo dõi trên sàn',
          },
          {
            key: 'pending',
            label: 'Chờ vendor tiếp nhận',
            value: tabCounts.pending,
            sub: 'Theo dõi SLA xác nhận của các gian hàng',
            tone: tabCounts.pending > 0 ? 'warning' : '',
            onClick: () => changeTab('pending'),
          },
          {
            key: 'shipping',
            label: 'Đang vận chuyển',
            value: tabCounts.shipping,
            sub: 'Đơn hàng đã bàn giao cho đơn vị vận chuyển',
            tone: 'info',
            onClick: () => changeTab('shipping'),
          },
        ]}
      />

      <PanelTabs
        items={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count: tabCounts[tab.key as keyof typeof tabCounts],
        }))}
        activeKey={activeTab}
        onChange={changeTab}
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Danh sách đơn hàng (Giám sát)</h2>
          </div>

          {isInitializing ? (
            <div className="admin-loading" style={{ padding: '3rem', textAlign: 'center' }}>Đang tải dữ liệu...</div>
          ) : isLoading ? null : loadError ? (
            <AdminStateBlock
              type="error"
              title="Không tải được danh sách đơn hàng"
              description={loadError}
              actionLabel="Thử lại"
              onAction={() => {
                setIsInitializing(true);
                void fetchOrders();
              }}
            />
          ) : filteredOrders.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? 'Không tìm thấy đơn hàng phù hợp' : 'Chưa có đơn hàng nào'}
              description={
                search.trim()
                  ? 'Thử đổi từ khóa hoặc đặt lại bộ lọc để xem lại toàn bộ đơn hàng.'
                  : 'Khi khách hàng checkout trên marketplace, đơn hàng sẽ xuất hiện tại đây để admin theo dõi.'
              }
              actionLabel={actions.resetFilters}
              onAction={resetCurrentView}
            />
          ) : (
            <div className="admin-table" role="table" aria-label="Bảng đơn hàng marketplace">
              <div className="admin-table-row admin-table-head orders" role="row">
                <div role="columnheader">
                  <input
                    type="checkbox"
                    aria-label={aria.selectAll}
                    checked={selected.size === filteredOrders.length && filteredOrders.length > 0}
                    onChange={(event) => toggleAll(event.target.checked)}
                  />
                </div>
                <div role="columnheader">Mã đơn</div>
                <div role="columnheader">Khách hàng</div>
                <div role="columnheader">Sản phẩm</div>
                <div role="columnheader" className="orders-col-gmv">GMV</div>
                <div role="columnheader">Thanh toán</div>
                <div role="columnheader">Thời gian</div>
                <div role="columnheader" className="orders-col-actions">Hành động</div>
              </div>

              {pagedOrders.map((order) => (
                <motion.div
                  key={order.id}
                  className="admin-table-row orders"
                  role="row"
                  whileHover={{ y: -1 }}
                  onClick={() => {
                    const routeKey = resolveDetailRouteKey(order.code, order.id);
                    if (!routeKey) return;
                    window.location.href = `/admin/orders/${routeKey}`;
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div role="cell" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      aria-label={aria.selectItem(displayOrderCode(order.code))}
                      checked={selected.has(order.id)}
                      onChange={(event) => toggleOne(order.id, event.target.checked)}
                    />
                  </div>
                  <div role="cell" className="admin-bold">#{displayOrderCode(order.code)}</div>
                  <div role="cell" className="customer-info-cell">
                    <img src={order.avatar} alt={order.customer} className="customer-avatar" />
                    <div className="customer-text">
                      <p className="admin-bold customer-name">{order.customer}</p>
                      <p className="admin-muted customer-email">{order.email}</p>
                    </div>
                  </div>
                  <div role="cell" className="order-product-cell">
                    <p className="admin-bold order-product-name">{order.productName}</p>
                    <p className="admin-muted order-product-meta">{order.productMeta}</p>
                    {order.productExtra ? <p className="order-product-extra">{order.productExtra}</p> : null}
                  </div>
                  <div role="cell" className="admin-bold order-total">{order.total}</div>
                  <div role="cell">
                    <span className={`admin-pill ${paymentMethodPillClass(order.paymentMethod)}`}>
                      {formatPaymentMethod(order.paymentMethod)}
                    </span>
                  </div>
                  <div role="cell" className="order-date-cell">
                    <span className="order-date-time">{new Date(order.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="order-date-day">{new Date(order.date).toLocaleDateString('vi-VN')}</span>
                  </div>
                  <div role="cell" className="admin-actions orders-actions" onClick={(event) => event.stopPropagation()}>
                    <Link
                      to={`/admin/orders/${resolveDetailRouteKey(order.code, order.id)}`}
                      className="admin-icon-btn subtle"
                      aria-label={actionTitles.viewDetail}
                    >
                      <Eye size={16} />
                    </Link>
                    <button
                      className="admin-icon-btn subtle"
                      type="button"
                      aria-label={actionTitles.printInvoice}
                      title={actionTitles.printInvoice}
                    >
                      <Printer size={16} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {!isLoading && filteredOrders.length > 0 && (
            <div className="table-footer">
              <span className="table-footer-meta">
                {c.showing(startIndex, endIndex, filteredOrders.length, 'đơn hàng')}
              </span>
              <div className="pagination">
                <button className="page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                  {c.previous}
                </button>
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index + 1}
                    className={`page-btn ${page === index + 1 ? 'active' : ''}`}
                    onClick={() => setPage(index + 1)}
                  >
                    {index + 1}
                  </button>
                ))}
                <button className="page-btn" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  {c.next}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {toast}
    </AdminLayout>
  );
};

export default AdminOrders;


