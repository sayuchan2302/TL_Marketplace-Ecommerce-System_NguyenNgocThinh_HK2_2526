import './Admin.css';
import { Link } from 'react-router-dom';
import { Filter, Search, Truck, Eye, Printer, Link2, CheckCircle2 } from 'lucide-react';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import AdminLayout from './AdminLayout';
import { AdminStateBlock } from './AdminStateBlocks';
import { useAdminListState } from './useAdminListState';
import {
  bulkTransitionToPacking,
  listAdminOrders,
  subscribeAdminOrders,
  transitionAdminOrder,
  type AdminOrderRecord,
} from './adminOrderService';
import { useAdminToast } from './useAdminToast';
import { ADMIN_DICTIONARY } from './adminDictionary';
import {
  canTransitionFulfillment,
  paymentLabel,
  shipLabel,
  type FulfillmentStatus,
  type PaymentStatus,
} from './orderWorkflow';
import { PanelStatsGrid, PanelTabs } from '../../components/Panel/PanelPrimitives';
import Portal from '../../components/Portal/Portal';
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
  paymentStatus: PaymentStatus;
  shipMethod: string;
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
    paymentStatus: order.paymentStatus,
    shipMethod: order.shipMethod,
    fulfillment: order.fulfillment,
    date: order.date,
  };
};

const displayOrderCode = (code: string) => toDisplayOrderCode(code);


const tone = (status: string) => {
  const lower = status.toLowerCase();
  if (lower.includes('thanh toan') || lower.includes('giao')) return 'success';
  if (lower.includes('dang') || lower.includes('cho')) return 'pending';
  if (lower.includes('that bai') || lower.includes('hoan tien') || lower.includes('huy')) return 'error';
  if (lower.includes('chua')) return 'neutral';
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
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const { toast, pushToast } = useAdminToast();

  const getSearchText = useCallback(
    (row: AdminOrderRow) =>
      `${displayOrderCode(row.code)} ${row.customer} ${row.email} ${row.phone} ${row.productName} ${row.productMeta} ${paymentLabel(row.paymentStatus)} ${shipLabel(row.fulfillment)}`,
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
      setRows(records.map(mapOrderRecordToRow));
    } catch (error: unknown) {
      console.error(error);
      setRows([]);
      setLoadError(getUiErrorMessage(error, 'Không thể tải danh sách đơn hàng từ backend.'));
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const unsubscribe = subscribeAdminOrders(fetchOrders);
    return unsubscribe;
  }, [fetchOrders]);

  const shareCurrentView = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      pushToast(ADMIN_DICTIONARY.messages.viewCopied);
    } catch {
      pushToast(ADMIN_DICTIONARY.messages.copyFailed);
    }
  };

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

  const handleBulkConfirm = async () => {
    const selectedCodes = rows
      .filter((row) => selected.has(row.id))
      .map((row) => row.code)
      .filter((code) => Boolean(code));
    const { updatedCodes, skippedCodes } = await bulkTransitionToPacking(selectedCodes, 'Admin');
    if (updatedCodes.length === 0) {
      pushToast('Không có đơn hàng hợp lệ để chuyển sang đóng gói.');
      return;
    }

    setSelected(new Set());
    setShowBulkConfirmModal(false);

    if (skippedCodes.length > 0) {
      pushToast(`Đã cập nhật ${updatedCodes.length} đơn, bỏ qua ${skippedCodes.length} đơn.`);
    } else {
      pushToast(`Đã chuyển ${updatedCodes.length} đơn sang đóng gói.`);
    }
    fetchOrders();
  };

  const handleBulkPrint = () => {
    if (selected.size === 0) return;
    pushToast(`Đang chuẩn bị phiếu in cho ${selected.size} đơn hàng.`);
  };

  const handleApproveOrder = async (code: string) => {
    if (!code) {
      pushToast('Đơn hàng này chưa được cấp mã công khai.');
      return;
    }
    const result = await transitionAdminOrder({
      code,
      nextFulfillment: 'packing',
      actor: 'Admin',
      source: 'orders_list',
    });

    if (!result.ok) {
      pushToast(result.error || 'Không thể cập nhật đơn hàng này.');
      return;
    }

    pushToast(result.message || 'Đã chuyển đơn hàng sang đóng gói.');
    fetchOrders();
  };

  const selectedCount = selected.size;
  const eligibleForConfirmCount = rows.filter(
    (row) => selected.has(row.id) && canTransitionFulfillment(row.fulfillment, 'packing', row.paymentStatus),
  ).length;
  const skippedCount = Math.max(0, selectedCount - eligibleForConfirmCount);

  return (
    <AdminLayout
      title="Đơn hàng"
      breadcrumbs={['Đơn hàng', 'Toàn cảnh điều hành']}
      actions={
        <>
          <div className="admin-search">
            <Search size={16} />
            <input
              placeholder="Tìm ORDER CODE, khách hàng hoặc sản phẩm"
              aria-label="Tìm ORDER CODE, khách hàng hoặc sản phẩm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="admin-ghost-btn" onClick={() => pushToast(ADMIN_DICTIONARY.messages.advancedFilterComingSoon)}>
            <Filter size={16} /> {c.filter}
          </button>
          <button className="admin-ghost-btn" onClick={shareCurrentView}>
            <Link2 size={16} /> {actions.shareView}
          </button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>
            {actions.resetView}
          </button>
        </>
      }
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
            sub: 'Cần theo dõi SLA xác nhận ở các gian hàng',
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
            <h2>Danh sách đơn hàng</h2>
            {selected.size > 0 && (
              <div className="admin-actions">
                <span className="admin-muted">{c.selected(selected.size, 'đơn hàng')}</span>
                <button className="admin-ghost-btn" onClick={() => setShowBulkConfirmModal(true)}>
                  Chuyển sang đóng gói
                </button>
                <button className="admin-ghost-btn" onClick={handleBulkPrint}>
                  Xuất / In
                </button>
              </div>
            )}
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
                <div role="columnheader">ORDER CODE</div>
                <div role="columnheader">Khách hàng</div>
                <div role="columnheader">Sản phẩm</div>
                <div role="columnheader" className="text-center">GMV</div>
                <div role="columnheader">Thanh toán</div>
                <div role="columnheader">Vận chuyển</div>
                <div role="columnheader">Ngày tạo</div>
                <div role="columnheader" className="text-right pr-12">Hành động</div>
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
                      <p className="customer-phone">{order.phone}</p>
                    </div>
                  </div>
                  <div role="cell" className="order-product-cell">
                    <p className="admin-bold order-product-name">{order.productName}</p>
                    <p className="admin-muted order-product-meta">{order.productMeta}</p>
                    {order.productExtra ? <p className="order-product-extra">{order.productExtra}</p> : null}
                  </div>
                  <div role="cell" className="admin-bold order-total">{order.total}</div>
                  <div role="cell">
                    <span className={`admin-pill ${tone(paymentLabel(order.paymentStatus))}`}>
                      {paymentLabel(order.paymentStatus)}
                    </span>
                  </div>
                  <div role="cell">
                    <div className="admin-ship">
                      <span className={`admin-pill ${tone(shipLabel(order.fulfillment))}`}>
                        <Truck size={14} /> {shipLabel(order.fulfillment)}
                      </span>
                      <span className="admin-muted order-ship-method">{order.shipMethod}</span>
                    </div>
                  </div>
                  <div role="cell" className="admin-muted order-date">{new Date(order.date).toLocaleDateString('vi-VN')}</div>
                  <div role="cell" className="admin-actions" onClick={(event) => event.stopPropagation()}>
                    <Link
                      to={`/admin/orders/${resolveDetailRouteKey(order.code, order.id)}`}
                      className="admin-icon-btn subtle"
                      aria-label={actionTitles.viewDetail}
                    >
                      <Eye size={16} />
                    </Link>
                    {order.fulfillment === 'pending' ? (
                      <button
                        className="admin-icon-btn subtle"
                        type="button"
                        aria-label="Đẩy vào hàng đợi đóng gói"
                        title="Đẩy vào hàng đợi đóng gói"
                        onClick={() => handleApproveOrder(order.code)}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                    ) : (
                      <button
                        className="admin-icon-btn subtle"
                        type="button"
                        aria-label={actionTitles.printInvoice}
                        title={actionTitles.printInvoice}
                      >
                        <Printer size={16} />
                      </button>
                    )}
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

      {selected.size > 0 && showBulkConfirmModal && (
        <Portal>
          <div className="drawer-overlay" onClick={() => setShowBulkConfirmModal(false)} />
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Xác nhận cập nhật đơn hàng hàng loạt"
          >
            <h3>Xác nhận can thiệp hàng đợi</h3>
            <p>Admin đang thao tác trên {selectedCount} đơn hàng đã chọn.</p>
            <div className="confirm-impact-grid">
              <div>
                <span className="admin-muted small">Đơn hợp lệ chuyển sang đóng gói</span>
                <p className="admin-bold">{eligibleForConfirmCount}</p>
              </div>
              <div>
                <span className="admin-muted small">Đơn bị bỏ qua</span>
                <p className="admin-bold">{skippedCount}</p>
              </div>
            </div>
            <div className="confirm-modal-actions">
              <button className="admin-ghost-btn" onClick={() => setShowBulkConfirmModal(false)}>
                Hủy
              </button>
              <button
                className="admin-primary-btn"
                onClick={handleBulkConfirm}
                disabled={eligibleForConfirmCount === 0}
              >
                Xác nhận can thiệp
              </button>
            </div>
          </div>
        </Portal>
      )}

      {toast ? <div className="toast success">{toast}</div> : null}
    </AdminLayout>
  );
};

export default AdminOrders;
