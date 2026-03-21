import './Admin.css';
import { Link } from 'react-router-dom';
import { Filter, Search, Truck, Eye, Printer, Link2, CheckCircle2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  canTransitionFulfillment,
  shipLabel,
  paymentLabel,
  type FulfillmentStatus,
  type PaymentStatus
} from './orderWorkflow';
import { AdminStateBlock, AdminTableSkeleton } from './AdminStateBlocks';
import { useAdminListState } from './useAdminListState';
import { bulkTransitionToPacking, listAdminOrders, subscribeAdminOrders, transitionAdminOrder, type AdminOrderRecord } from './adminOrderService';
import { ADMIN_VIEW_KEYS } from './adminListView';
import { useAdminViewState } from './useAdminViewState';
import { useAdminToast } from './useAdminToast';
import { ADMIN_ACTION_TITLES, ADMIN_COMMON_LABELS } from './adminUiLabels';
import { ADMIN_TOAST_MESSAGES } from './adminMessages';
import { ADMIN_TEXT } from './adminText';

interface AdminOrderRow {
  code: string;
  customer: string;
  email: string;
  avatar: string;
  total: string;
  paymentStatus: PaymentStatus;
  shipMethod: string;
  fulfillment: FulfillmentStatus;
  date: string;
}

const mapOrderRecordToRow = (order: AdminOrderRecord): AdminOrderRow => ({
  code: order.code,
  customer: order.customer,
  email: order.customerInfo.email,
  avatar: order.avatar,
  total: order.total,
  paymentStatus: order.paymentStatus,
  shipMethod: order.shipMethod,
  fulfillment: order.fulfillment,
  date: order.date,
});

const initialOrders: AdminOrderRow[] = listAdminOrders().map(mapOrderRecordToRow);

const tone = (status: string) => {
  const s = status.toLowerCase();
  if (s.includes('đã thanh toán') || s.includes('đã giao')) return 'success';
  if (s.includes('đang') || s.includes('chờ')) return 'pending';
  if (s.includes('thất bại') || s.includes('hoàn tiền')) return 'error';
  if (s.includes('chưa')) return 'neutral';
  return 'neutral';
};

const tabs = [
  { key: 'all', label: ADMIN_TEXT.orders.tabs.all },
  { key: 'urgent', label: ADMIN_TEXT.orders.tabs.urgent },
  { key: 'pending', label: ADMIN_TEXT.orders.tabs.pending },
  { key: 'packing', label: ADMIN_TEXT.orders.tabs.packing },
  { key: 'shipping', label: ADMIN_TEXT.orders.tabs.shipping },
  { key: 'done', label: ADMIN_TEXT.orders.tabs.done },
  { key: 'canceled', label: ADMIN_TEXT.orders.tabs.canceled },
];

const validStatusKeys = new Set(tabs.map((tab) => tab.key));

const isPendingOver30Minutes = (row: AdminOrderRow) => {
  if (row.fulfillment !== 'pending') return false;
  const placedAt = new Date(row.date).getTime();
  if (Number.isNaN(placedAt)) return false;
  const diffMinutes = (Date.now() - placedAt) / (1000 * 60);
  return diffMinutes > 30;
};

const formatDateTime = (value: string) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN', { hour12: false, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const validStatusKeysArray = Array.from(validStatusKeys);

const AdminOrders = () => {
  const t = ADMIN_TEXT.orders;
  const c = ADMIN_TEXT.common;
  const aria = useMemo(() => c.aria, []);
  const view = useAdminViewState({
    storageKey: ADMIN_VIEW_KEYS.orders,
    path: '/admin/orders',
    validStatusKeys: validStatusKeysArray,
    defaultStatus: 'all',
  });
  const activeTab = validStatusKeys.has(view.status) ? view.status : 'all';
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<AdminOrderRow[]>(initialOrders);
  const { toast, pushToast } = useAdminToast();
  const [showBulkConfirmModal, setShowBulkConfirmModal] = useState(false);
  const getSearchText = useCallback((o: AdminOrderRow) => `${o.code} ${o.customer} ${paymentLabel(o.paymentStatus)} ${shipLabel(o.fulfillment)}`, []);
  const filterPredicate = useCallback((o: AdminOrderRow) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'urgent') return isPendingOver30Minutes(o);
    return o.fulfillment === activeTab;
  }, [activeTab]);

  const {
    search,
    isLoading,
    filteredItems: filteredOrders,
    pagedItems: pagedOrders,
    page,
    totalPages,
    startIndex,
    endIndex,
    next,
    prev,
    setPage,
  } = useAdminListState<AdminOrderRow>({
    items: rows,
    pageSize: 6,
    searchValue: view.search,
    onSearchChange: view.setSearch,
    pageValue: view.page,
    onPageChange: view.setPage,
    getSearchText,
    filterPredicate,
    loadingDeps: [activeTab],
  });

  const shareCurrentView = async () => {
    try {
      await view.shareCurrentView();
      pushToast(ADMIN_TOAST_MESSAGES.viewCopied);
    } catch {
      pushToast(ADMIN_TOAST_MESSAGES.copyFailed);
    }
  };

  const resetCurrentView = () => {
    setSelected(new Set());
    view.resetCurrentView();
    pushToast(ADMIN_TOAST_MESSAGES.orders.resetView);
  };

  const activeTabLabel = tabs.find((tab) => tab.key === activeTab)?.label || t.tabs.all;
  const hasViewContext = activeTab !== 'all' || Boolean(search.trim()) || view.page > 1;

  const tabCounts = {
    all: rows.length,
    urgent: rows.filter((o) => isPendingOver30Minutes(o)).length,
    pending: rows.filter((o) => o.fulfillment === 'pending').length,
    packing: rows.filter((o) => o.fulfillment === 'packing').length,
    shipping: rows.filter((o) => o.fulfillment === 'shipping').length,
    done: rows.filter((o) => o.fulfillment === 'done').length,
    canceled: rows.filter((o) => o.fulfillment === 'canceled').length,
  } as const;

  const changeTab = (nextTab: string) => {
    setSelected(new Set());
    view.setStatus(nextTab);
  };

  const handleSearchChange = (value: string) => {
    view.setSearch(value);
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(filteredOrders.map(o => o.code)));
    } else {
      setSelected(new Set());
    }
  };

  const toggleOne = (code: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(code); else next.delete(code);
    setSelected(next);
  };

  const handleBulkConfirm = () => {
    const { updatedCodes, skippedCodes } = bulkTransitionToPacking(Array.from(selected), 'Admin');
    if (updatedCodes.length === 0) {
      pushToast(ADMIN_TOAST_MESSAGES.orders.noEligibleBulkConfirm);
      return;
    }
    setSelected(new Set());
    if (skippedCodes.length > 0) {
      pushToast(ADMIN_TOAST_MESSAGES.orders.bulkConfirmedWithSkipped(updatedCodes.length, skippedCodes.length));
    } else {
      pushToast(ADMIN_TOAST_MESSAGES.orders.bulkConfirmed(updatedCodes.length));
    }
    setShowBulkConfirmModal(false);
  };

  const selectedCount = selected.size;
  const eligibleForConfirmCount = rows.filter(o => selected.has(o.code) && canTransitionFulfillment(o.fulfillment, 'packing', o.paymentStatus)).length;
  const skippedCount = Math.max(0, selectedCount - eligibleForConfirmCount);

  const handleBulkPrint = () => {
    if (selected.size === 0) return;
    pushToast(ADMIN_TOAST_MESSAGES.orders.preparingPrint(selected.size));
  };

  const handleApproveOrder = (code: string) => {
    const result = transitionAdminOrder({
      code,
      nextFulfillment: 'packing',
      actor: 'Admin',
      source: 'orders_list',
    });
    if (!result.ok) {
      pushToast(result.error || 'Không thể duyệt đơn hàng.');
      return;
    }
    pushToast(result.message || 'Đã duyệt đơn hàng.');
  };

  useEffect(() => {
    const syncOrders = () => {
      setRows(listAdminOrders().map(mapOrderRecordToRow));
    };
    const unsubscribe = subscribeAdminOrders(syncOrders);
    syncOrders();
    return unsubscribe;
  }, []);

  return (
    <AdminLayout 
      title={t.title}
      actions={
        <>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} value={search} onChange={e => handleSearchChange(e.target.value)} />
          </div>
          <button className="admin-ghost-btn" onClick={() => pushToast(ADMIN_TOAST_MESSAGES.advancedFilterComingSoon)}><Filter size={16} /> {c.filter}</button>
          <button className="admin-ghost-btn" onClick={shareCurrentView}><Link2 size={16} /> {ADMIN_COMMON_LABELS.shareView}</button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>{ADMIN_COMMON_LABELS.resetView}</button>
        </>
      }
    >
      <div className="admin-tabs">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`admin-tab ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => changeTab(tab.key)}
          >
            <span>{tab.label}</span>
            <span className="admin-tab-count">{tabCounts[tab.key as keyof typeof tabCounts]}</span>
          </button>
        ))}
      </div>

      {hasViewContext && (
        <div className="admin-view-summary">
          <span className="summary-chip">{c.statusLabel}: {activeTabLabel}</span>
          {search.trim() && <span className="summary-chip">{c.keyword}: {search.trim()}</span>}
          <button className="summary-clear" onClick={resetCurrentView}>{c.clearFilters}</button>
        </div>
      )}

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>{t.panelTitle}</h2>
            <Link to="/admin">{t.overview}</Link>
          </div>
          {isLoading ? (
            <AdminTableSkeleton columns={8} rows={6} />
          ) : filteredOrders.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? t.empty.searchTitle : t.empty.defaultTitle}
              description={search.trim() ? t.empty.searchDescription : t.empty.defaultDescription}
              actionLabel={ADMIN_COMMON_LABELS.resetFilters}
              onAction={resetCurrentView}
            />
          ) : (
            <div className="admin-table" role="table" aria-label={t.tableAria}>
            <div className="admin-table-row admin-table-head orders" role="row">
              <div role="columnheader">
                <input
                  type="checkbox"
                  aria-label={aria.selectAll}
                  checked={selected.size === filteredOrders.length && filteredOrders.length > 0}
                  onChange={e => toggleAll(e.target.checked)}
                />
              </div>
              <div role="columnheader">{t.columns.orderCode}</div>
              <div role="columnheader">{t.columns.customer}</div>
              <div role="columnheader" className="text-center">{t.columns.total}</div>
              <div role="columnheader">{t.columns.payment}</div>
              <div role="columnheader">{t.columns.shipping}</div>
              <div role="columnheader">{t.columns.createdAt}</div>
              <div role="columnheader" className="text-right pr-12">{t.columns.actions}</div>
            </div>
            {pagedOrders.map((order, idx) => (
              <motion.div
                className="admin-table-row orders"
                role="row"
                key={order.code}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.16) }}
                whileHover={{ y: -1 }}
                onClick={() => window.location.href = `/admin/orders/${order.code}`}
                style={{ cursor: 'pointer' }}
              >
                <div role="cell" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    aria-label={aria.selectItem(order.code)}
                    checked={selected.has(order.code)}
                    onChange={e => toggleOne(order.code, e.target.checked)}
                  />
                </div>
                <div role="cell" className="admin-bold">#{order.code}</div>
                <div role="cell" className="customer-info-cell">
                  <img src={order.avatar} alt={order.customer} className="customer-avatar" />
                  <div className="customer-text">
                    <p className="admin-bold customer-name">{order.customer}</p>
                    <p className="admin-muted customer-email">{order.email}</p>
                  </div>
                </div>
                <div role="cell" className="admin-bold order-total">{order.total}</div>
                <div role="cell"><span className={`admin-pill ${tone(paymentLabel(order.paymentStatus))}`}>{paymentLabel(order.paymentStatus)}</span></div>
                <div role="cell">
                  <div className="admin-ship">
                    <span className={`admin-pill ${tone(shipLabel(order.fulfillment))}`}><Truck size={14} /> {shipLabel(order.fulfillment)}</span>
                    <span className="admin-muted order-ship-method">{order.shipMethod}</span>
                  </div>
                </div>
                <div role="cell" className="admin-muted order-date">{formatDateTime(order.date)}</div>
                <div role="cell" className="admin-actions" onClick={(e) => e.stopPropagation()}>
                  <Link to={`/admin/orders/${order.code}`} className="admin-icon-btn subtle" aria-label={ADMIN_ACTION_TITLES.viewDetail}>
                    <Eye size={16} />
                  </Link>
                  {order.fulfillment === 'pending' ? (
                    <button
                      className="admin-icon-btn subtle"
                      type="button"
                      aria-label={ADMIN_ACTION_TITLES.approveOrder}
                      title={ADMIN_ACTION_TITLES.approveOrder}
                      onClick={() => handleApproveOrder(order.code)}
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  ) : (
                    <button className="admin-icon-btn subtle" type="button" aria-label={ADMIN_ACTION_TITLES.printInvoice}>
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
              <span className="table-footer-meta">{c.showing(startIndex, endIndex, filteredOrders.length, t.selectedNoun)}</span>
              <div className="pagination">
                <button className="page-btn" onClick={prev} disabled={page === 1}>{c.previous}</button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button key={idx + 1} className={`page-btn ${page === idx + 1 ? 'active' : ''}`} onClick={() => setPage(idx + 1)}>
                    {idx + 1}
                  </button>
                ))}
                <button className="page-btn" onClick={next} disabled={page === totalPages}>{c.next}</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            className="admin-floating-bar"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 22 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="admin-floating-content">
              <span>{c.selected(selected.size, t.selectedNoun)}</span>
              <div className="admin-actions">
                <button className="admin-ghost-btn" onClick={() => setShowBulkConfirmModal(true)}>{t.bulkActions.confirm}</button>
                <button className="admin-ghost-btn" onClick={handleBulkPrint}>{t.bulkActions.printInvoice}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {selected.size > 0 && showBulkConfirmModal && (
        <>
          <div className="drawer-overlay" onClick={() => setShowBulkConfirmModal(false)} />
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-label="Xác nhận đơn hàng hàng loạt">
            <h3>{t.bulkActions.modalTitle}</h3>
            <p>{t.bulkActions.modalDescription(selectedCount)}</p>
            <div className="confirm-impact-grid">
              <div>
                <span className="admin-muted small">{t.bulkActions.eligibleLabel}</span>
                <p className="admin-bold">{eligibleForConfirmCount}</p>
              </div>
              <div>
                <span className="admin-muted small">{t.bulkActions.skippedLabel}</span>
                <p className="admin-bold">{skippedCount}</p>
              </div>
            </div>
            <div className="confirm-modal-actions">
              <button className="admin-ghost-btn" onClick={() => setShowBulkConfirmModal(false)}>{t.bulkActions.cancel}</button>
              <button className="admin-primary-btn" onClick={handleBulkConfirm} disabled={eligibleForConfirmCount === 0}>{t.bulkActions.confirmBulk}</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast success">{toast}</div>}
    </AdminLayout>
  );
};

export default AdminOrders;
