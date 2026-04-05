import './Admin.css';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, Eye, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminLayout from './AdminLayout';
import { AdminStateBlock } from './AdminStateBlocks';
import {
  listAdminParentOrders,
  subscribeAdminOrders,
  transitionAdminOrder,
  type AdminParentOrderSummary,
  type AdminSubOrderSummary,
} from './adminOrderService';
import { useAdminToast } from './useAdminToast';
import { paymentLabel, shipLabel, type FulfillmentStatus } from './orderWorkflow';
import { PanelStatsGrid, PanelTabs } from '../../components/Panel/PanelPrimitives';
import { getUiErrorMessage } from '../../utils/errorMessage';
import { resolveDetailRouteKey, toDisplayOrderCode } from '../../utils/displayCode';

const PAGE_SIZE = 8;

const tabs: Array<{ key: 'all' | FulfillmentStatus; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'packing', label: 'Packing' },
  { key: 'shipping', label: 'Shipping' },
  { key: 'done', label: 'Completed' },
  { key: 'canceled', label: 'Canceled' },
];

const tone = (status: string) => {
  const lower = status.toLowerCase();
  if (lower.includes('paid') || lower.includes('ship') || lower.includes('done')) return 'success';
  if (lower.includes('pending') || lower.includes('pack')) return 'pending';
  if (lower.includes('cancel') || lower.includes('failed')) return 'error';
  return 'neutral';
};

const SubOrderRow = memo(({ subOrder }: { subOrder: AdminSubOrderSummary }) => (
  <div className="admin-table-row orders order-tree-sub-row" role="row">
    <div role="cell" className="order-tree-sub-code">
      #{toDisplayOrderCode(subOrder.code)}
    </div>
    <div role="cell">
      <p className="admin-bold">{subOrder.vendorName}</p>
      <p className="admin-muted small">{subOrder.customerName}</p>
    </div>
    <div role="cell">
      <span className={`admin-pill ${tone(shipLabel(subOrder.fulfillment))}`}>{shipLabel(subOrder.fulfillment)}</span>
    </div>
    <div role="cell" className="admin-bold">
      {subOrder.total.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
    </div>
    <div role="cell" className="admin-muted small">
      {subOrder.itemCount} items
    </div>
    <div role="cell" className="admin-muted small">
      {subOrder.trackingNumber || '-'}
    </div>
  </div>
));

SubOrderRow.displayName = 'SubOrderRow';

interface ParentOrderRowProps {
  order: AdminParentOrderSummary;
  expanded: boolean;
  onToggle: (id: string) => void;
  onApprove: (code: string) => void;
}

const ParentOrderRow = memo(({ order, expanded, onToggle, onApprove }: ParentOrderRowProps) => (
  <>
    <motion.div
      className="admin-table-row orders order-tree-parent-row"
      role="row"
      whileHover={{ y: -1 }}
      style={{ willChange: 'transform' }}
    >
      <div role="cell">
        <button
          type="button"
          className="admin-icon-btn subtle order-tree-toggle"
          onClick={() => onToggle(order.id)}
          aria-label={expanded ? 'Collapse order' : 'Expand order'}
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
      <div role="cell" className="admin-bold">
        #{toDisplayOrderCode(order.code)}
      </div>
      <div role="cell">
        <p className="admin-bold">{order.customerName}</p>
        <p className="admin-muted small">{order.customerEmail}</p>
      </div>
      <div role="cell">
        <span className={`admin-pill ${tone(shipLabel(order.fulfillment))}`}>{shipLabel(order.fulfillment)}</span>
      </div>
      <div role="cell" className="admin-bold">
        {order.total.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}
      </div>
      <div role="cell">
        <span className={`admin-pill ${tone(paymentLabel(order.paymentStatus))}`}>{paymentLabel(order.paymentStatus)}</span>
      </div>
      <div role="cell" className="admin-muted order-date">
        {new Date(order.createdAt).toLocaleDateString('vi-VN')}
      </div>
      <div role="cell" className="admin-actions orders-actions">
        <Link
          to={`/admin/orders/${resolveDetailRouteKey(order.code, order.id)}`}
          className="admin-icon-btn subtle"
          aria-label="View order detail"
        >
          <Eye size={16} />
        </Link>
        {order.fulfillment === 'pending' ? (
          <button
            type="button"
            className="admin-icon-btn subtle"
            onClick={() => onApprove(order.code)}
            aria-label="Move to packing"
          >
            <CheckCircle2 size={16} />
          </button>
        ) : null}
      </div>
    </motion.div>

    {expanded ? (
      <div className="order-tree-sub-table">
        <div className="admin-table-row admin-table-head orders order-tree-sub-head" role="row">
          <div role="columnheader">Suborder Code</div>
          <div role="columnheader">Vendor</div>
          <div role="columnheader">Fulfillment</div>
          <div role="columnheader">Value</div>
          <div role="columnheader">Items</div>
          <div role="columnheader">Tracking</div>
        </div>
        {order.subOrders.map((subOrder) => (
          <SubOrderRow key={subOrder.id} subOrder={subOrder} />
        ))}
      </div>
    ) : null}
  </>
));

ParentOrderRow.displayName = 'ParentOrderRow';

const AdminOrders = () => {
  const [rows, setRows] = useState<AdminParentOrderSummary[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | FulfillmentStatus>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [isInitializing, setIsInitializing] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, pushToast } = useAdminToast();

  const fetchOrders = useCallback(async () => {
    setLoadError(null);
    try {
      const records = await listAdminParentOrders();
      setRows(records);
    } catch (error: unknown) {
      setRows([]);
      setLoadError(getUiErrorMessage(error, 'Cannot load order list from backend.'));
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
    const unsubscribe = subscribeAdminOrders(() => {
      void fetchOrders();
    });
    return unsubscribe;
  }, [fetchOrders]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (activeTab !== 'all' && row.fulfillment !== activeTab) {
        return false;
      }
      if (!normalizedSearch) return true;
      const fullText = [
        row.code,
        row.customerName,
        row.customerEmail,
        row.customerPhone,
        ...row.subOrders.map((sub) => `${sub.code} ${sub.vendorName} ${sub.trackingNumber}`),
      ]
        .join(' ')
        .toLowerCase();
      return fullText.includes(normalizedSearch);
    });
  }, [activeTab, rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startIndex = filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(filteredRows.length, safePage * PAGE_SIZE);
  const pagedRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  const tabCounts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((row) => row.fulfillment === 'pending').length,
      packing: rows.filter((row) => row.fulfillment === 'packing').length,
      shipping: rows.filter((row) => row.fulfillment === 'shipping').length,
      done: rows.filter((row) => row.fulfillment === 'done').length,
      canceled: rows.filter((row) => row.fulfillment === 'canceled').length,
    }),
    [rows],
  );

  const onToggle = useCallback((orderId: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      return next;
    });
  }, []);

  const onApprove = useCallback(
    async (code: string) => {
      if (!code) return;
      const result = await transitionAdminOrder({
        code,
        nextFulfillment: 'packing',
        actor: 'Admin',
        source: 'orders_list',
      });
      if (!result.ok) {
        pushToast(result.error || 'Cannot update order status.');
        return;
      }
      pushToast(result.message || 'Order moved to packing.');
      void fetchOrders();
    },
    [fetchOrders, pushToast],
  );

  return (
    <AdminLayout title="Orders" breadcrumbs={['Orders', 'Order Operations']}>
      <PanelStatsGrid
        items={[
          {
            key: 'all',
            label: 'Total Parent Orders',
            value: tabCounts.all,
            sub: 'Marketplace checkout grouped by parent order',
          },
          {
            key: 'pending',
            label: 'Waiting Vendor Confirm',
            value: tabCounts.pending,
            sub: 'Need SLA monitoring',
            tone: tabCounts.pending > 0 ? 'warning' : '',
            onClick: () => setActiveTab('pending'),
          },
          {
            key: 'shipping',
            label: 'Shipping',
            value: tabCounts.shipping,
            sub: 'In transport stage',
            tone: 'info',
            onClick: () => setActiveTab('shipping'),
          },
        ]}
      />

      <PanelTabs
        items={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count: tabCounts[tab.key],
        }))}
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as 'all' | FulfillmentStatus)}
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Order Tree View</h2>
            <div className="admin-actions">
              <input
                className="admin-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order, customer, vendor..."
                aria-label="Search orders"
              />
            </div>
          </div>

          {isInitializing ? (
            <div className="admin-loading" style={{ padding: '3rem', textAlign: 'center' }}>
              Loading data...
            </div>
          ) : loadError ? (
            <AdminStateBlock
              type="error"
              title="Cannot load orders"
              description={loadError}
              actionLabel="Retry"
              onAction={() => {
                setIsInitializing(true);
                void fetchOrders();
              }}
            />
          ) : filteredRows.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? 'No matching orders found' : 'No orders yet'}
              description="When customers checkout, parent orders and sub-orders will appear here."
            />
          ) : (
            <div className="admin-table order-tree-table" role="table" aria-label="Order tree">
              <div className="admin-table-row admin-table-head orders" role="row">
                <div role="columnheader" />
                <div role="columnheader">Order Code</div>
                <div role="columnheader">Customer</div>
                <div role="columnheader">Fulfillment</div>
                <div role="columnheader">GMV</div>
                <div role="columnheader">Payment</div>
                <div role="columnheader">Created</div>
                <div role="columnheader" className="orders-col-actions">
                  Actions
                </div>
              </div>
              {pagedRows.map((row) => (
                <ParentOrderRow
                  key={row.id}
                  order={row}
                  expanded={expandedRows.has(row.id)}
                  onToggle={onToggle}
                  onApprove={onApprove}
                />
              ))}
            </div>
          )}

          {!isInitializing && !loadError && filteredRows.length > 0 ? (
            <div className="table-footer">
              <span className="table-footer-meta">
                Showing {startIndex}-{endIndex} of {filteredRows.length} orders
              </span>
              <div className="pagination">
                <button
                  className="page-btn"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                >
                  Prev
                </button>
                {Array.from({ length: totalPages }).map((_, index) => {
                  const pageValue = index + 1;
                  return (
                    <button
                      key={pageValue}
                      className={`page-btn ${safePage === pageValue ? 'active' : ''}`}
                      onClick={() => setPage(pageValue)}
                    >
                      {pageValue}
                    </button>
                  );
                })}
                <button
                  className="page-btn"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {toast ? <div className="toast success">{toast}</div> : null}
    </AdminLayout>
  );
};

export default AdminOrders;
