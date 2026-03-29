import './AdminFinancials.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, CheckCircle2, Eye, Link2, Search, WalletCards, X } from 'lucide-react';
import AdminLayout from './AdminLayout';
import AdminConfirmDialog from './AdminConfirmDialog';
import { AdminStateBlock } from './AdminStateBlocks';
import { PanelStatsGrid, PanelTabs } from '../../components/Panel/PanelPrimitives';
import { useToast } from '../../contexts/ToastContext';
import Drawer from '../../components/Drawer/Drawer';
import { apiRequest } from '../../services/apiClient';

interface WalletResponse {
  id: string;
  storeId: string;
  storeName: string;
  storeSlug?: string | null;
  balance: number;
  lastUpdated: string;
}

type ConfirmState = {
  storeIds: string[];
  storeNames: string[];
};

const formatCurrency = (value: number) =>
  value.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
const STORE_REF_FALLBACK = 'chua-co-slug';
const toStoreRef = (record: WalletResponse) => `@${record.storeSlug?.trim() || STORE_REF_FALLBACK}`;

const AdminFinancials = () => {
  const { addToast } = useToast();
  const [wallets, setWallets] = useState<WalletResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailRecord, setDetailRecord] = useState<WalletResponse | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');

  const fetchWallets = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await apiRequest<{ content?: WalletResponse[] }>('/api/wallets', {}, { auth: true });
      setWallets(data.content || []);
    } catch {
      addToast('Lỗi khi tải dữ liệu đối soát.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchWallets();
  }, [fetchWallets]);

  const records = useMemo(() => wallets, [wallets]);


  const filteredRecords = useMemo(() => {
    let next = records;
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      next = next.filter((record) =>
        `${record.storeName} ${record.storeSlug || ''}`.toLowerCase().includes(query),
      );
    }
    return next;
  }, [records, search]);

  const totals = useMemo(() => ({
    gmv: 0,
    commission: 0,
    payout: records.reduce((sum, record) => sum + record.balance, 0),
    review: 0,
  }), [records]);

  const PAGE_SIZE = 8;
  const totalPages = Math.max(Math.ceil(filteredRecords.length / PAGE_SIZE), 1);
  const safePage = Math.min(page, totalPages);
  const pagedRecords = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, safePage]);

  const resetCurrentView = () => {
    setSearch('');
    setActiveTab('all');
    setSelected(new Set());
    setPage(1);
  };

  const shareCurrentView = async () => {
    await navigator.clipboard.writeText(window.location.href);
    addToast('Đã sao chép bộ lọc hiện tại của tài chính sàn', 'success');
  };

  const openReleaseConfirm = (storeIds: string[]) => {
    const items = records.filter((record) => storeIds.includes(record.storeId) && record.balance > 0);
    if (items.length === 0) {
      addToast('Không có ví nào có số dư để giải ngân.', 'info');
      return;
    }

    setConfirmState({
      storeIds: items.map((item) => item.storeId),
      storeNames: items.map((item) => item.storeName),
    });
  };

  const applyPayout = async () => {
    if (!confirmState) return;
    
    try {
      for (const storeId of confirmState.storeIds) {
        await apiRequest(`/api/wallets/${storeId}/withdraw`, { method: 'POST' }, { auth: true });
      }
      setSelected(new Set());
      setConfirmState(null);
      addToast('Đã xác nhận giải ngân thành công.', 'success');
      await fetchWallets();
    } catch {
      addToast('Lỗi trong quá trình giải ngân.', 'error');
    }
  };

  return (
    <AdminLayout
      title="Tài chính sàn"
      breadcrumbs={['Tài chính sàn', 'Đối soát và giải ngân']}
      actions={(
        <>
          <div className="admin-search">
            <Search size={16} />
            <input
              placeholder="Tìm theo kỳ đối soát, phạm vi hoặc mã đơn"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <button className="admin-ghost-btn" onClick={() => void shareCurrentView()}>
            <Link2 size={16} />
            Chia sẻ bộ lọc
          </button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>Đặt lại</button>
        </>
      )}
    >
      <PanelStatsGrid
        items={[
          { key: 'gmv', label: 'GMV toàn sàn', value: formatCurrency(totals.gmv), sub: 'Tổng giá trị đơn hàng từ bảng vận hành hiện tại' },
          { key: 'commission', label: 'Commission thực thu', value: formatCurrency(totals.commission), sub: 'Tổng phí sàn từ các đơn đã hoàn tất', tone: 'info' },
          { key: 'payout', label: 'Payout phải trả', value: formatCurrency(totals.payout), sub: 'Tổng số tiền đủ điều kiện giải ngân cho shop', tone: 'success' },
          { key: 'review', label: 'Cần rà soát', value: totals.review, sub: 'Nhóm đơn có hủy hoặc điều chỉnh cần kiểm tra', tone: totals.review > 0 ? 'danger' : '', onClick: () => setActiveTab('review') },
        ]}
      />

      <PanelTabs
        items={[
          { key: 'all', label: 'Tất cả ví store', count: records.length }
        ]}
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          setSelected(new Set());
          setPage(1);
        }}
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Sổ đối soát và commission</h2>
            {selected.size > 0 && (
              <div className="admin-actions">
                <span className="admin-muted">Đã chọn {selected.size} bản ghi</span>
                <button className="admin-ghost-btn" onClick={() => openReleaseConfirm(Array.from(selected))}>
                  Xác nhận giải ngân
                </button>
                <button className="admin-ghost-btn" onClick={() => setSelected(new Set())}>Bỏ chọn</button>
              </div>
            )}
          </div>

          {filteredRecords.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? 'Không tìm thấy bản ghi tài chính phù hợp' : 'Chưa có bản ghi tài chính'}
              description={
                search.trim()
                  ? 'Thử đổi từ khóa hoặc đặt lại bộ lọc để xem lại danh sách đối soát.'
                  : 'Bản ghi tài chính sẽ xuất hiện khi hệ thống có dữ liệu đơn hàng đủ để tổng hợp payout và commission.'
              }
              actionLabel="Đặt lại bộ lọc"
              onAction={resetCurrentView}
            />
          ) : (
            <>
              <div className="admin-table" role="table" aria-label="Bảng đối soát tài chính sàn">
                <div className="admin-table-row financials admin-table-head" role="row">
                  <div role="columnheader">
                    <input
                      type="checkbox"
                      checked={selected.size === filteredRecords.length && filteredRecords.length > 0}
                      onChange={(event) => setSelected(event.target.checked ? new Set(filteredRecords.map((item) => item.storeId)) : new Set())}
                    />
                  </div>
                  <div role="columnheader">Slug cửa hàng</div>
                  <div role="columnheader">Tên Cửa hàng</div>
                  <div role="columnheader">Số dư hiện tại</div>
                  <div role="columnheader">Cập nhật lần cuối</div>
                  <div role="columnheader">Hành động</div>
                </div>

                {isLoading ? (
                  <div className="admin-loading" style={{ padding: '3rem', textAlign: 'center' }}>Đang tải dữ liệu ví...</div>
                ) : pagedRecords.map((record) => (
                  <motion.div
                    key={record.id}
                    className="admin-table-row financials"
                    style={{ gridTemplateColumns: '40px 1.5fr 2fr 1.5fr 1.5fr 100px' }}
                    role="row"
                    whileHover={{ y: -1 }}
                  >
                    <div role="cell" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(record.storeId)}
                        onChange={(event) => {
                          const next = new Set(selected);
                          if (event.target.checked) next.add(record.storeId);
                          else next.delete(record.storeId);
                          setSelected(next);
                        }}
                      />
                    </div>
                    <div role="cell">
                      <div className="admin-bold">{toStoreRef(record)}</div>
                    </div>
                    <div role="cell">
                      <div className="admin-bold">{record.storeName}</div>
                    </div>
                    <div role="cell" className="admin-bold">
                      <span className={`admin-pill ${record.balance > 0 ? 'success' : 'neutral'}`}>{formatCurrency(record.balance)}</span>
                    </div>
                    <div role="cell">
                      <div className="admin-muted small">{new Date(record.lastUpdated).toLocaleString('vi-VN')}</div>
                    </div>
                    <div role="cell" className="admin-actions">
                      <button className="admin-icon-btn subtle" title="Xem chi tiết" aria-label="Xem chi tiết" onClick={() => setDetailRecord(record)}>
                        <Eye size={16} />
                      </button>
                      {record.balance > 0 && (
                        <button className="admin-icon-btn subtle" title="Giải ngân" aria-label="Giải ngân" onClick={() => openReleaseConfirm([record.storeId])}>
                          <CheckCircle2 size={16} />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {!isLoading && (
                <div className="table-footer">
                  <span className="table-footer-meta">
                    Hiển thị {(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, filteredRecords.length)} trên {filteredRecords.length} bản ghi
                  </span>
                  <div className="pagination">
                    <button className="page-btn" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(current - 1, 1))}>Trước</button>
                    {Array.from({ length: totalPages }).map((_, index) => (
                      <button key={index + 1} className={`page-btn ${safePage === index + 1 ? 'active' : ''}`} onClick={() => setPage(index + 1)}>
                        {index + 1}
                      </button>
                    ))}
                    <button className="page-btn" disabled={safePage === totalPages} onClick={() => setPage((current) => Math.min(current + 1, totalPages))}>Sau</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <AdminConfirmDialog
        open={Boolean(confirmState)}
        title="Xác nhận giải ngân payout"
        description="Số dư hiện tại trên ví của các store sẽ bị trừ để ghi nhận đã giải ngân cho nhà bán hàng (qua chuyển khoản ngân hàng ngoài hệ thống)."
        selectedItems={confirmState?.storeNames}
        selectedNoun="bản ghi tài chính"
        confirmLabel="Xác nhận giải ngân"
        onCancel={() => setConfirmState(null)}
        onConfirm={applyPayout}
      />

      <Drawer open={Boolean(detailRecord)} onClose={() => setDetailRecord(null)} className="financial-drawer">
        {detailRecord ? (
          <>
            <div className="drawer-header">
              <div>
                <p className="drawer-eyebrow">Chi tiết tài chính</p>
                <h3>{detailRecord.storeName}</h3>
              </div>
              <button className="admin-icon-btn" onClick={() => setDetailRecord(null)} aria-label="Đóng chi tiết tài chính">
                <X size={16} />
              </button>
            </div>

            <div className="drawer-body">
              <section className="drawer-section">
                <h4>Tổng quan ví điện tử</h4>
                <div className="financial-drawer-hero">
                    <div className="financial-avatar">
                    <WalletCards size={22} />
                  </div>
                  <div>
                    <div className="admin-bold">Store: {toStoreRef(detailRecord)}</div>
                    <div className="admin-muted">{detailRecord.storeName}</div>
                  </div>
                  <span className={`admin-pill ${detailRecord.balance > 0 ? 'success' : 'neutral'}`}>
                    {detailRecord.balance > 0 ? 'Khả dụng' : 'Trống'}
                  </span>
                </div>
              </section>

              <section className="drawer-section">
                <h4>Bảng tóm tắt ví</h4>
                <div className="financial-signal-grid">
                  <div className="financial-signal-card">
                    <span className="admin-muted small">Số dư hiện tại</span>
                    <strong>{formatCurrency(detailRecord.balance)}</strong>
                  </div>
                  <div className="financial-signal-card">
                    <span className="admin-muted small">Cập nhật lúc</span>
                    <strong>{new Date(detailRecord.lastUpdated).toLocaleString('vi-VN')}</strong>
                  </div>
                </div>
              </section>
            </div>

            <div className="drawer-footer">
              <button className="admin-ghost-btn" onClick={() => setDetailRecord(null)}>Đóng</button>
              {detailRecord.balance > 0 && (
                <button className="admin-primary-btn" onClick={() => openReleaseConfirm([detailRecord.storeId])}>
                  <ArrowUpRight size={14} />
                  Xác nhận giải ngân
                </button>
              )}
            </div>
          </>
        ) : null}
      </Drawer>
    </AdminLayout>
  );
};

export default AdminFinancials;
