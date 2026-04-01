import './Admin.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Eye, ShieldAlert, XCircle } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { AdminStateBlock } from './AdminStateBlocks';
import { useAdminListState } from './useAdminListState';
import { useAdminToast } from './useAdminToast';
import { returnService, type AdminVerdictAction, type ReturnRequest, type ReturnStatus } from '../../services/returnService';
import {
  PanelDrawerFooter,
  PanelDrawerHeader,
  PanelDrawerSection,
  PanelSearchField,
  PanelStatsGrid,
  PanelTabs,
  PanelTableFooter,
} from '../../components/Panel/PanelPrimitives';
import Drawer from '../../components/Drawer/Drawer';
import { getUiErrorMessage } from '../../utils/errorMessage';
import { toDisplayOrderCode, toDisplayReturnCode } from '../../utils/displayCode';

const statusConfig: Record<ReturnStatus, { label: string; pillClass: string }> = {
  PENDING_VENDOR: { label: 'Chờ vendor xử lý', pillClass: 'admin-pill pending' },
  ACCEPTED: { label: 'Đã chấp nhận', pillClass: 'admin-pill info' },
  SHIPPING: { label: 'Đang hoàn gửi', pillClass: 'admin-pill info' },
  RECEIVED: { label: 'Vendor đang kiểm', pillClass: 'admin-pill warning' },
  COMPLETED: { label: 'Đã hoàn tiền', pillClass: 'admin-pill success' },
  REJECTED: { label: 'Từ chối', pillClass: 'admin-pill danger' },
  DISPUTED: { label: 'Tranh chấp', pillClass: 'admin-pill danger' },
  CANCELLED: { label: 'Đã hủy', pillClass: 'admin-pill neutral' },
};

const TABS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'disputed', label: 'Tranh chấp' },
  { key: 'pendingVendor', label: 'Chờ vendor' },
  { key: 'inProgress', label: 'Đang xử lý' },
  { key: 'completed', label: 'Đã hoàn tiền' },
  { key: 'rejected', label: 'Đã từ chối' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

const reasonLabel: Record<string, string> = {
  SIZE: 'Không đúng kích cỡ',
  DEFECT: 'Lỗi sản phẩm',
  CHANGE: 'Muốn đổi sản phẩm',
  OTHER: 'Lý do khác',
};

const resolutionLabel: Record<string, string> = {
  EXCHANGE: 'Đổi sản phẩm',
  REFUND: 'Hoàn tiền',
};

const PAGE_SIZE = 8;
const FETCH_SIZE = 100;

const formatVnd = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatDateTime = (value?: string) => {
  if (!value) return 'Chưa cập nhật';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa cập nhật';
  return date.toLocaleString('vi-VN', {
    hour12: false,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getReturnAmount = (request: ReturnRequest) => {
  if (typeof request.refundAmount === 'number') return request.refundAmount;
  return request.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);
};

const tabPredicate = (tab: TabKey, item: ReturnRequest): boolean => {
  if (tab === 'all') return true;
  if (tab === 'disputed') return item.status === 'DISPUTED';
  if (tab === 'pendingVendor') return item.status === 'PENDING_VENDOR';
  if (tab === 'completed') return item.status === 'COMPLETED';
  if (tab === 'rejected') return item.status === 'REJECTED';
  if (tab === 'inProgress') {
    return item.status === 'ACCEPTED' || item.status === 'SHIPPING' || item.status === 'RECEIVED';
  }
  return true;
};

const AdminReturns = () => {
  const { pushToast } = useAdminToast();
  const [activeTab, setActiveTab] = useState<TabKey>('disputed');
  const [searchQuery, setSearchQuery] = useState('');
  const [allReturns, setAllReturns] = useState<ReturnRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drawerItem, setDrawerItem] = useState<ReturnRequest | null>(null);
  const [drawerNote, setDrawerNote] = useState('');
  const [page, setPage] = useState(1);

  const drawerItemCount = useMemo(
    () => (drawerItem ? drawerItem.items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0) : 0),
    [drawerItem],
  );
  const drawerRefundTotal = useMemo(() => (drawerItem ? getReturnAmount(drawerItem) : 0), [drawerItem]);

  const fetchAllReturns = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const firstPage = await returnService.listAdmin({ page: 0, size: FETCH_SIZE });
      const records = [...(firstPage.content || [])];
      const totalPages = Math.max(Number(firstPage.totalPages || 1), 1);

      for (let currentPage = 1; currentPage < totalPages; currentPage += 1) {
        const nextPage = await returnService.listAdmin({ page: currentPage, size: FETCH_SIZE });
        records.push(...(nextPage.content || []));
      }

      setAllReturns(records);
    } catch (error: unknown) {
      setAllReturns([]);
      setLoadError(getUiErrorMessage(error, 'Không tải được danh sách yêu cầu hoàn trả từ backend.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAllReturns();
  }, [fetchAllReturns]);

  const tabCounts = useMemo(
    () => ({
      all: allReturns.length,
      disputed: allReturns.filter((item) => item.status === 'DISPUTED').length,
      pendingVendor: allReturns.filter((item) => item.status === 'PENDING_VENDOR').length,
      inProgress: allReturns.filter((item) => item.status === 'ACCEPTED' || item.status === 'SHIPPING' || item.status === 'RECEIVED').length,
      completed: allReturns.filter((item) => item.status === 'COMPLETED').length,
      rejected: allReturns.filter((item) => item.status === 'REJECTED').length,
    }),
    [allReturns],
  );

  const stats = useMemo(
    () => ({
      totalAmount: allReturns.reduce((sum, item) => sum + getReturnAmount(item), 0),
      disputedAmount: allReturns
        .filter((item) => item.status === 'DISPUTED')
        .reduce((sum, item) => sum + getReturnAmount(item), 0),
    }),
    [allReturns],
  );

  const {
    search,
    setSearch,
    filteredItems,
    pagedItems,
    page: safePage,
    setPage: setSafePage,
    totalPages,
    startIndex,
    endIndex,
  } = useAdminListState<ReturnRequest>({
    items: allReturns,
    pageSize: PAGE_SIZE,
    searchValue: searchQuery,
    onSearchChange: setSearchQuery,
    pageValue: page,
    onPageChange: setPage,
    getSearchText: (item) =>
      `${item.id} ${item.code || ''} ${item.orderCode || ''} ${item.customerName || ''} ${item.customerEmail || ''} ${
        item.storeName || ''
      } ${reasonLabel[item.reason] || item.reason} ${resolutionLabel[item.resolution] || item.resolution}`,
    filterPredicate: (item) => tabPredicate(activeTab, item),
    loadingDeps: [activeTab],
  });

  const applyFinalVerdict = async (id: string, action: AdminVerdictAction) => {
    try {
      setActionLoading(true);
      const adminNote = drawerItem?.id === id ? drawerNote : undefined;
      const updated = await returnService.adminFinalVerdict(id, action, adminNote);

      setAllReturns((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setDrawerItem((current) => (current?.id === id ? updated : current));
      if (drawerItem?.id === id) setDrawerNote('');

      pushToast(
        action === 'REFUND_TO_CUSTOMER'
          ? `Đã ra phán quyết hoàn tiền cho ${toDisplayReturnCode(updated.code)}.`
          : `Đã ra phán quyết giữ tiền cho vendor với ${toDisplayReturnCode(updated.code)}.`,
      );
    } catch (error: unknown) {
      pushToast(getUiErrorMessage(error, 'Không thể xử lý phán quyết tranh chấp.'));
    } finally {
      setActionLoading(false);
    }
  };

  const resetCurrentView = () => {
    setActiveTab('disputed');
    setSearch('');
    setSafePage(1);
  };

  return (
    <AdminLayout title="Hoàn trả" breadcrumbs={['Đơn hàng', 'Hoàn trả & Tranh chấp']}>
      <PanelStatsGrid
        items={[
          {
            key: 'disputed',
            label: 'Cần trọng tài',
            value: tabCounts.disputed,
            sub: formatVnd(stats.disputedAmount),
            tone: tabCounts.disputed > 0 ? 'danger' : 'info',
            onClick: () => setActiveTab('disputed'),
          },
          {
            key: 'pendingVendor',
            label: 'Chờ vendor',
            value: tabCounts.pendingVendor,
            sub: 'Vendor chưa phản hồi',
            tone: tabCounts.pendingVendor > 0 ? 'warning' : '',
            onClick: () => setActiveTab('pendingVendor'),
          },
          {
            key: 'inProgress',
            label: 'Đang xử lý',
            value: tabCounts.inProgress,
            sub: 'Đang vận chuyển/kiểm hàng',
            tone: 'info',
            onClick: () => setActiveTab('inProgress'),
          },
          {
            key: 'completed',
            label: 'Đã hoàn tiền',
            value: tabCounts.completed,
            sub: formatVnd(stats.totalAmount),
            tone: 'success',
            onClick: () => setActiveTab('completed'),
          },
        ]}
      />

      <PanelTabs
        items={TABS.map((tab) => ({
          key: tab.key,
          label: tab.label,
          count: tabCounts[tab.key],
        }))}
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key as TabKey);
          setSafePage(1);
        }}
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Danh sách yêu cầu hoàn trả</h2>
            <div className="admin-actions">
              <PanelSearchField
                placeholder="Tìm mã yêu cầu, mã đơn, khách hàng, gian hàng..."
                value={search}
                onChange={setSearch}
              />
              {tabCounts.disputed > 0 && (
                <span className="admin-pill danger">
                  <ShieldAlert size={14} />
                  {tabCounts.disputed} tranh chấp chờ phán quyết
                </span>
              )}
            </div>
          </div>

          {isLoading ? (
            <AdminStateBlock
              type="empty"
              title="Đang tải danh sách hoàn trả"
              description="Hệ thống đang đồng bộ dữ liệu yêu cầu đổi trả."
            />
          ) : loadError ? (
            <AdminStateBlock
              type="error"
              title="Không tải được danh sách yêu cầu hoàn trả"
              description={loadError}
              actionLabel="Thử lại"
              onAction={() => void fetchAllReturns()}
            />
          ) : filteredItems.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? 'Không tìm thấy yêu cầu phù hợp' : 'Chưa có yêu cầu hoàn trả'}
              description={
                search.trim()
                  ? 'Thử đổi từ khóa hoặc đặt lại bộ lọc để xem lại dữ liệu.'
                  : 'Khi khách gửi yêu cầu đổi trả, danh sách sẽ xuất hiện tại đây.'
              }
              actionLabel="Đặt lại"
              onAction={resetCurrentView}
            />
          ) : (
            <>
              <div className="admin-table" role="table" aria-label="Bảng yêu cầu hoàn trả">
                <div className="admin-table-row admin-table-head returns-row" role="row">
                  <div role="columnheader">Mã yêu cầu</div>
                  <div role="columnheader">Khách hàng</div>
                  <div role="columnheader">Sản phẩm</div>
                  <div role="columnheader">Giá trị</div>
                  <div role="columnheader">Trạng thái</div>
                  <div role="columnheader">Tạo lúc</div>
                  <div role="columnheader">Phán quyết</div>
                  <div role="columnheader">Hành động</div>
                </div>

                {pagedItems.map((item) => (
                  <motion.div
                    key={item.id}
                    className={`admin-table-row returns-row ${item.status === 'DISPUTED' ? 'returns-row-disputed' : ''}`}
                    role="row"
                    whileHover={{ y: -1 }}
                    onClick={() => setDrawerItem(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div role="cell" className="returns-code-cell" title={toDisplayReturnCode(item.code)}>
                      <strong className="returns-ellipsis">{toDisplayReturnCode(item.code)}</strong>
                      <small className="admin-muted returns-ellipsis">
                        Đơn #{toDisplayOrderCode(item.orderCode)}
                      </small>
                    </div>
                    <div role="cell" className="returns-customer-cell" title={item.customerName}>
                      <strong className="returns-ellipsis">{item.customerName}</strong>
                      <small className="admin-muted returns-ellipsis">{item.customerEmail || 'Chưa có email'}</small>
                    </div>
                    <div role="cell" className="returns-product-cell" title={item.items.map((i) => i.productName).join(', ')}>
                      <span className="returns-ellipsis">
                        {item.items.map((product) => `${product.productName} (x${product.quantity})`).join(', ')}
                      </span>
                      <small className="admin-muted returns-ellipsis">
                        {item.storeName || 'Chưa xác định gian hàng'} • {reasonLabel[item.reason] || item.reason}
                      </small>
                    </div>
                    <div role="cell" className="returns-amount">
                      {formatVnd(getReturnAmount(item))}
                    </div>
                    <div role="cell">
                      <span className={statusConfig[item.status].pillClass}>{statusConfig[item.status].label}</span>
                    </div>
                    <div role="cell" className="admin-muted order-date">
                      {formatDateTime(item.createdAt)}
                    </div>
                    <div role="cell" className="returns-verdict-cell">
                      {item.status === 'COMPLETED' ? (
                        <span className="admin-pill success">Hoàn tiền khách</span>
                      ) : item.status === 'REJECTED' ? (
                        <span className="admin-pill neutral">Giữ tiền vendor</span>
                      ) : (
                        <span className="admin-muted">Chưa phán quyết</span>
                      )}
                    </div>
                    <div role="cell" className="admin-actions returns-actions" onClick={(event) => event.stopPropagation()}>
                      <button className="admin-icon-btn subtle" title="Xem chi tiết" onClick={() => setDrawerItem(item)}>
                        <Eye size={16} />
                      </button>
                      {item.status === 'DISPUTED' && (
                        <>
                          <button
                            className="admin-icon-btn subtle"
                            title="Hoàn tiền cho khách"
                            disabled={actionLoading}
                            onClick={() => void applyFinalVerdict(item.id, 'REFUND_TO_CUSTOMER')}
                          >
                            <CheckCircle2 size={16} />
                          </button>
                          <button
                            className="admin-icon-btn subtle danger-icon"
                            title="Giữ tiền cho vendor"
                            disabled={actionLoading}
                            onClick={() => void applyFinalVerdict(item.id, 'RELEASE_TO_VENDOR')}
                          >
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              <PanelTableFooter
                meta={`Hiển thị ${startIndex}-${endIndex} trên ${filteredItems.length} yêu cầu`}
                page={safePage}
                totalPages={totalPages}
                onPageChange={setSafePage}
                prevLabel="Trước"
                nextLabel="Sau"
              />
            </>
          )}
        </div>
      </section>

      <Drawer
        open={Boolean(drawerItem)}
        onClose={() => {
          setDrawerItem(null);
          setDrawerNote('');
        }}
        className="returns-drawer"
      >
        {drawerItem ? (
          <>
            <PanelDrawerHeader
              eyebrow={drawerItem.status === 'DISPUTED' ? 'Tranh chấp cần phán quyết' : 'Yêu cầu hoàn trả'}
              title={toDisplayReturnCode(drawerItem.code)}
              onClose={() => {
                setDrawerItem(null);
                setDrawerNote('');
              }}
              closeLabel="Đóng chi tiết hoàn trả"
            />

            <div className="drawer-body">
              <PanelDrawerSection title="Tổng quan yêu cầu">
                <div className="returns-meta-grid">
                  <article className="returns-meta-card">
                    <span className="returns-meta-label">Mã đơn</span>
                    <strong>#{toDisplayOrderCode(drawerItem.orderCode)}</strong>
                  </article>
                  <article className="returns-meta-card">
                    <span className="returns-meta-label">Khách hàng</span>
                    <strong>{drawerItem.customerName}</strong>
                    <small className="admin-muted">{drawerItem.customerEmail || 'Chưa có email'}</small>
                  </article>
                  <article className="returns-meta-card">
                    <span className="returns-meta-label">Gian hàng</span>
                    <strong>{drawerItem.storeName || 'Chưa xác định'}</strong>
                    <small className="admin-muted">{drawerItem.customerPhone || 'Chưa có số điện thoại khách'}</small>
                  </article>
                  <article className="returns-meta-card">
                    <span className="returns-meta-label">Trạng thái</span>
                    <strong>{statusConfig[drawerItem.status].label}</strong>
                    <small className="admin-muted">
                      Hình thức: {resolutionLabel[drawerItem.resolution] || drawerItem.resolution}
                    </small>
                  </article>
                  <article className="returns-meta-card">
                    <span className="returns-meta-label">Giá trị yêu cầu</span>
                    <strong>{formatVnd(drawerRefundTotal)}</strong>
                    <small className="admin-muted">Tạo: {formatDateTime(drawerItem.createdAt)}</small>
                  </article>
                </div>
              </PanelDrawerSection>

              <PanelDrawerSection title="Lý do & diễn biến">
                <div className="returns-reason-box">
                  <div className="admin-card-row">
                    <span className="admin-bold">Lý do khách</span>
                    <span className="admin-muted">{reasonLabel[drawerItem.reason] || drawerItem.reason}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Ghi chú khách</span>
                    <span className="admin-muted">{drawerItem.note?.trim() || 'Không có ghi chú bổ sung'}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Lý do vendor từ chối</span>
                    <span className="admin-muted">{drawerItem.vendorReason?.trim() || 'Chưa có'}</span>
                  </div>
                  <div className="admin-card-row">
                    <span className="admin-bold">Lý do khách tranh chấp</span>
                    <span className="admin-muted">{drawerItem.disputeReason?.trim() || 'Chưa có'}</span>
                  </div>
                </div>
              </PanelDrawerSection>

              {drawerItem.items.length > 0 && (
                <PanelDrawerSection title={`Sản phẩm trả lại (${drawerItemCount})`}>
                  <div className="returns-items-list">
                    {drawerItem.items.map((item) => (
                      <article key={item.orderItemId} className="returns-item-card">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.productName} className="returns-item-image" />
                        ) : (
                          <div className="returns-item-image placeholder">SP</div>
                        )}
                        <div className="returns-item-content">
                          <strong className="returns-item-name">{item.productName}</strong>
                          <small className="admin-muted">{item.variantName || 'Biến thể mặc định'}</small>
                          <div className="returns-item-meta">
                            <span>x{item.quantity}</span>
                            <span>{formatVnd(item.unitPrice)}</span>
                            <span className="admin-bold">{formatVnd(item.unitPrice * item.quantity)}</span>
                          </div>
                          {item.evidenceUrl ? (
                            <a className="admin-link" href={item.evidenceUrl} target="_blank" rel="noreferrer">
                              Xem evidence
                            </a>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </PanelDrawerSection>
              )}

              <PanelDrawerSection title="Ghi chú trọng tài">
                <div className="returns-note-box">
                  <p className="returns-note-label">Ghi chú hiện tại</p>
                  <p className="returns-note-text">{drawerItem.adminNote?.trim() || 'Chưa có ghi chú trọng tài'}</p>
                </div>
                <div className="returns-note-input-wrap">
                  <label htmlFor="admin-return-note" className="returns-note-label">
                    Cập nhật ghi chú mới
                  </label>
                  <textarea
                    id="admin-return-note"
                    value={drawerNote}
                    onChange={(event) => setDrawerNote(event.target.value)}
                    rows={4}
                    placeholder="Nhập ghi chú cho phán quyết cuối cùng..."
                    className="returns-note-input"
                  />
                </div>
              </PanelDrawerSection>
            </div>

            <PanelDrawerFooter>
              <button
                className="admin-ghost-btn"
                onClick={() => {
                  setDrawerItem(null);
                  setDrawerNote('');
                }}
              >
                Đóng
              </button>

              {drawerItem.status === 'DISPUTED' && (
                <>
                  <button
                    className="admin-ghost-btn danger"
                    disabled={actionLoading}
                    onClick={() => void applyFinalVerdict(drawerItem.id, 'RELEASE_TO_VENDOR')}
                  >
                    <XCircle size={14} />
                    Giữ tiền vendor
                  </button>
                  <button
                    className="admin-primary-btn"
                    disabled={actionLoading}
                    onClick={() => void applyFinalVerdict(drawerItem.id, 'REFUND_TO_CUSTOMER')}
                  >
                    <CheckCircle2 size={14} />
                    Hoàn tiền khách
                  </button>
                </>
              )}
            </PanelDrawerFooter>
          </>
        ) : null}
      </Drawer>
    </AdminLayout>
  );
};

export default AdminReturns;
