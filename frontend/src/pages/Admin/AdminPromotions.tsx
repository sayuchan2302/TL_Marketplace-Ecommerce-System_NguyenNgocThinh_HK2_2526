import './Admin.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Pencil, Pause, Play, X, Trash2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { AdminStateBlock } from './AdminStateBlocks';
import AdminConfirmDialog from './AdminConfirmDialog';
import { useAdminListState } from './useAdminListState';
import { ADMIN_VIEW_KEYS } from './adminListView';
import { useAdminViewState } from './useAdminViewState';
import { useAdminToast } from './useAdminToast';
import { PanelTabs } from '../../components/Panel/PanelPrimitives';
import Drawer from '../../components/Drawer/Drawer';
import {
  adminPromotionService,
  type AdminPromotionDiscountType,
  type AdminPromotionRecord,
  type AdminPromotionStatus,
  type AdminPromotionUpsertInput,
} from '../../services/adminPromotionService';
import { promotionStatusClass, promotionStatusLabel } from './adminStatusMaps';
import { storeService, type StoreProfile } from '../../services/storeService';

interface PromotionFormState extends AdminPromotionUpsertInput {
  id?: string;
}

const ALL_MARKETPLACE_STORE = '__ALL_MARKETPLACE__';

const emptyPromotion = (): PromotionFormState => ({
  storeId: '',
  name: '',
  code: '',
  description: '',
  discountType: 'percent',
  discountValue: 10,
  minOrderValue: 0,
  totalIssued: 1000,
  startDate: '',
  endDate: '',
  status: 'paused',
});

const formatCurrency = (value: number) => `${value.toLocaleString('vi-VN')} ₫`;
const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
};

const normalizeCode = (value: string) => value.trim().replace(/\s+/g, '').toUpperCase();
const isAllMarketplaceSelection = (storeId: string) => storeId === ALL_MARKETPLACE_STORE;

const toUpsertInput = (form: PromotionFormState, storeIdOverride?: string): AdminPromotionUpsertInput => ({
  storeId: storeIdOverride ?? form.storeId,
  name: form.name,
  code: form.code,
  description: form.description,
  discountType: form.discountType,
  discountValue: form.discountValue,
  minOrderValue: form.minOrderValue,
  totalIssued: form.totalIssued,
  startDate: form.startDate,
  endDate: form.endDate,
  status: form.status,
});

const deriveStatus = (promotion: AdminPromotionRecord): 'running' | 'paused' | 'expired' => {
  const endDate = new Date(promotion.endDate);
  if (!Number.isNaN(endDate.getTime())) {
    endDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (endDate < today) {
      return 'expired';
    }
  }

  if (promotion.status === 'running') return 'running';
  return 'paused';
};

const validateForm = (
  form: PromotionFormState,
  rows: AdminPromotionRecord[],
  editingId: string | null,
  selectableStores: StoreProfile[],
) => {
  if (!form.storeId) return 'Vui lòng chọn gian hàng áp dụng.';
  if (isAllMarketplaceSelection(form.storeId) && selectableStores.length === 0) {
    return 'Không có gian hàng đã duyệt để áp dụng voucher toàn sàn.';
  }
  if (editingId && isAllMarketplaceSelection(form.storeId)) {
    return 'Không thể chuyển chiến dịch hiện có sang toàn sàn. Hãy tạo chiến dịch mới.';
  }
  if (!form.name.trim()) return 'Tên chiến dịch không được để trống.';
  if (!form.code.trim()) return 'Mã voucher không được để trống.';
  if (!/^[A-Z0-9-]{4,24}$/.test(form.code)) return 'Mã chỉ gồm chữ hoa, số và dấu gạch ngang.';

  const targetStoreIds = isAllMarketplaceSelection(form.storeId)
    ? selectableStores.map((store) => store.id)
    : [form.storeId];
  const duplicatedVoucher = rows.find(
    (item) =>
      targetStoreIds.includes(item.storeId) &&
      normalizeCode(item.code) === normalizeCode(form.code) &&
      item.id !== editingId,
  );
  if (
    duplicatedVoucher
  ) {
    if (isAllMarketplaceSelection(form.storeId)) {
      return `Mã voucher đã tồn tại ở gian hàng "${duplicatedVoucher.storeName || duplicatedVoucher.storeId}".`;
    }
    return 'Mã voucher đã tồn tại trong gian hàng đã chọn.';
  }
  if (form.discountValue <= 0) return 'Giá trị giảm phải lớn hơn 0.';
  if (form.discountType === 'percent' && form.discountValue > 100) {
    return 'Phần trăm giảm không được vượt 100%.';
  }
  if (form.minOrderValue < 0) return 'Giá trị đơn tối thiểu không hợp lệ.';
  if (form.totalIssued < 1) return 'Tổng số lượng phát hành phải lớn hơn 0.';
  if (!form.startDate || !form.endDate) return 'Hãy chọn đầy đủ lịch chiến dịch.';
  if (new Date(form.endDate) < new Date(form.startDate)) return 'Ngày kết thúc phải sau ngày bắt đầu.';
  return null;
};

const discountTypeLabel = (type: AdminPromotionDiscountType) => (type === 'percent' ? 'Giảm %' : 'Giảm tiền');
const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

const AdminPromotions = () => {
  const view = useAdminViewState({
    storageKey: ADMIN_VIEW_KEYS.promotions,
    path: '/admin/promotions',
    validStatusKeys: ['all', 'running', 'paused', 'expired'],
    defaultStatus: 'all',
  });
  const [rows, setRows] = useState<AdminPromotionRecord[]>([]);
  const [stores, setStores] = useState<StoreProfile[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PromotionFormState>(emptyPromotion());
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { toast, pushToast } = useAdminToast();

  const selectableStores = useMemo(
    () => stores.filter((store) => store.approvalStatus === 'APPROVED'),
    [stores],
  );

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const [promotionSnapshot, storeSnapshot] = await Promise.all([
        adminPromotionService.list({ page: 1, size: 300 }),
        storeService.getAdminStores(),
      ]);
      setRows(promotionSnapshot.items);
      setStores(storeSnapshot);
    } catch (error: unknown) {
      setLoadError(getErrorMessage(error, 'Không thể tải dữ liệu khuyến mãi.'));
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const {
    search,
    isLoading,
    filteredItems,
    pagedItems,
    page,
    totalPages,
    startIndex,
    endIndex,
    next,
    prev,
    setPage,
  } = useAdminListState<AdminPromotionRecord>({
    items: rows,
    pageSize: 7,
    searchValue: view.search,
    onSearchChange: view.setSearch,
    pageValue: view.page,
    onPageChange: view.setPage,
    getSearchText: (item) => `${item.name} ${item.code} ${item.description} ${item.storeName}`,
    filterPredicate: (item) => view.status === 'all' || deriveStatus(item) === view.status,
    loadingDeps: [view.status],
  });

  const stats = useMemo(() => {
    const running = rows.filter((item) => deriveStatus(item) === 'running').length;
    const paused = rows.filter((item) => deriveStatus(item) === 'paused').length;
    const expired = rows.filter((item) => deriveStatus(item) === 'expired').length;
    const totalIssued = rows.reduce((sum, item) => sum + item.totalIssued, 0);
    const totalUsed = rows.reduce((sum, item) => sum + item.usedCount, 0);
    return {
      running,
      paused,
      expired,
      usageRate: totalIssued > 0 ? Math.round((totalUsed / totalIssued) * 100) : 0,
    };
  }, [rows]);

  const resetView = () => {
    view.resetCurrentView();
    setSelected(new Set());
    pushToast('Đã đặt lại bộ lọc chiến dịch.');
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyPromotion(),
      storeId: selectableStores.length > 0 ? ALL_MARKETPLACE_STORE : '',
    });
    setIsDrawerOpen(true);
  };

  const openEdit = (promotion: AdminPromotionRecord) => {
    setEditingId(promotion.id);
    setForm({
      id: promotion.id,
      storeId: promotion.storeId,
      name: promotion.name,
      code: promotion.code,
      description: promotion.description,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      minOrderValue: promotion.minOrderValue,
      totalIssued: promotion.totalIssued,
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      status: promotion.status,
    });
    setIsDrawerOpen(true);
  };

  const savePromotion = async () => {
    const error = validateForm(form, rows, editingId, selectableStores);
    if (error) {
      pushToast(error);
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingId) {
        await adminPromotionService.update(editingId, toUpsertInput(form));
        pushToast('Đã cập nhật chiến dịch.');
      } else if (isAllMarketplaceSelection(form.storeId)) {
        const targetStores = selectableStores.map((store) => store.id);
        const requests = targetStores.map((storeId) =>
          adminPromotionService.create(toUpsertInput(form, storeId)),
        );
        const settled = await Promise.allSettled(requests);
        const successCount = settled.filter((result) => result.status === 'fulfilled').length;
        const failedCount = settled.length - successCount;

        if (successCount === 0) {
          const firstReject = settled.find((result) => result.status === 'rejected');
          const reason = firstReject && firstReject.status === 'rejected' ? firstReject.reason : null;
          throw reason instanceof Error ? reason : new Error('Không thể tạo chiến dịch toàn sàn.');
        }

        if (failedCount > 0) {
          pushToast(`Đã tạo ${successCount} voucher toàn sàn (${failedCount} gian hàng lỗi).`);
        } else {
          pushToast(`Đã tạo voucher toàn sàn cho ${successCount} gian hàng.`);
        }
      } else {
        await adminPromotionService.create(toUpsertInput(form));
        pushToast('Đã tạo chiến dịch mới.');
      }
      setIsDrawerOpen(false);
      await loadData();
    } catch (error: unknown) {
      pushToast(getErrorMessage(error, 'Không thể lưu chiến dịch.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePause = async (promotion: AdminPromotionRecord) => {
    const nextStatus: AdminPromotionStatus = promotion.status === 'running' ? 'paused' : 'running';
    try {
      await adminPromotionService.updateStatus(promotion.id, nextStatus);
      pushToast(nextStatus === 'paused' ? 'Đã tạm dừng chiến dịch.' : 'Đã kích hoạt lại chiến dịch.');
      await loadData();
    } catch (error: unknown) {
      pushToast(getErrorMessage(error, 'Không thể cập nhật trạng thái chiến dịch.'));
    }
  };

  const pauseSelected = async () => {
    const selectedRows = rows.filter((row) => selected.has(row.id));
    const eligible = selectedRows.filter((row) => row.status === 'running');
    if (eligible.length === 0) {
      pushToast('Không có chiến dịch nào hợp lệ để tạm dừng.');
      return;
    }

    try {
      await Promise.all(eligible.map((row) => adminPromotionService.updateStatus(row.id, 'paused')));
      setSelected(new Set());
      pushToast(`Đã tạm dừng ${eligible.length} chiến dịch.`);
      await loadData();
    } catch (error: unknown) {
      pushToast(getErrorMessage(error, 'Không thể cập nhật hàng loạt.'));
    }
  };

  const deleteSelected = async () => {
    if (!deleteIds?.length) return;
    try {
      await Promise.all(deleteIds.map((id) => adminPromotionService.delete(id)));
      setSelected(new Set());
      setDeleteIds(null);
      pushToast('Đã xóa chiến dịch khỏi hệ thống.');
      await loadData();
    } catch (error: unknown) {
      pushToast(getErrorMessage(error, 'Không thể xóa chiến dịch.'));
    }
  };

  return (
    <AdminLayout
      title="Khuyến mãi"
      breadcrumbs={['Khuyến mãi', 'Chiến dịch điều hành']}
      actions={
        <button className="admin-primary-btn" onClick={openCreate} disabled={selectableStores.length === 0}>
          <Plus size={16} /> Tạo Voucher
        </button>
      }
    >
      <div className="admin-stats grid-4">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Tổng chiến dịch</div>
          <div className="admin-stat-value">{rows.length}</div>
          <div className="admin-stat-sub">Tỷ lệ sử dụng toàn sàn: {stats.usageRate}%</div>
        </div>
        <div className="admin-stat-card success" onClick={() => view.setStatus('running')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-label">Đang chạy</div>
          <div className="admin-stat-value">{stats.running}</div>
          <div className="admin-stat-sub">Chiến dịch đang hoạt động</div>
        </div>
        <div className="admin-stat-card warning" onClick={() => view.setStatus('paused')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-label">Tạm dừng</div>
          <div className="admin-stat-value">{stats.paused}</div>
          <div className="admin-stat-sub">Tạm ngưng hoặc draft</div>
        </div>
        <div className="admin-stat-card danger" onClick={() => view.setStatus('expired')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-label">Hết hạn</div>
          <div className="admin-stat-value">{stats.expired}</div>
          <div className="admin-stat-sub">Cần gia hạn hoặc dọn dẹp</div>
        </div>
      </div>

      <PanelTabs
        items={[
          { key: 'all', label: 'Tất cả', count: rows.length },
          { key: 'running', label: 'Đang chạy', count: stats.running },
          { key: 'paused', label: 'Tạm dừng', count: stats.paused },
          { key: 'expired', label: 'Hết hạn', count: stats.expired },
        ]}
        activeKey={view.status}
        onChange={(key) => view.setStatus(key)}
      />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>Kho voucher</h2>
            {selected.size > 0 && (
              <div className="admin-actions">
                <span className="admin-muted">{selected.size} đã chọn</span>
                <button className="admin-ghost-btn" onClick={() => void pauseSelected()}>Tạm dừng</button>
                <button className="admin-ghost-btn danger" onClick={() => setDeleteIds(Array.from(selected))}>Xóa</button>
              </div>
            )}
          </div>

          {isInitializing ? (
            <div className="admin-loading" style={{ padding: '3rem', textAlign: 'center' }}>Đang tải dữ liệu chiến dịch...</div>
          ) : loadError && rows.length === 0 ? (
            <AdminStateBlock
              type="error"
              title="Không thể tải chiến dịch"
              description={loadError}
              actionLabel="Thử lại"
              onAction={() => void loadData()}
            />
          ) : isLoading ? null : filteredItems.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? 'Không tìm thấy chiến dịch phù hợp' : 'Chưa có chiến dịch'}
              description={search.trim() ? 'Thử đổi từ khóa hoặc đặt lại bộ lọc.' : 'Các voucher toàn sàn sẽ hiển thị tại đây khi backend có dữ liệu.'}
              actionLabel="Đặt lại"
              onAction={resetView}
            />
          ) : (
            <div className="admin-table" role="table" aria-label="Bảng chiến dịch toàn sàn">
              <div className="admin-table-row admin-table-head promotions" role="row">
                <div role="columnheader"><input type="checkbox" checked={selected.size === filteredItems.length && filteredItems.length > 0} onChange={(e) => setSelected(e.target.checked ? new Set(filteredItems.map((item) => item.id)) : new Set())} /></div>
                <div role="columnheader">Chiến dịch</div>
                <div role="columnheader">Loại giảm giá</div>
                <div role="columnheader">Giá trị</div>
                <div role="columnheader">Điều kiện</div>
                <div role="columnheader">Đã sử dụng</div>
                <div role="columnheader">Lịch trình</div>
                <div role="columnheader">Trạng thái</div>
                <div role="columnheader">Hành động</div>
              </div>
              {pagedItems.map((promo) => {
                const usedPercent = promo.totalIssued > 0 ? Math.min(100, Math.round((promo.usedCount / promo.totalIssued) * 100)) : 0;
                const currentStatus = deriveStatus(promo);
                return (
                  <motion.div
                    key={promo.id}
                    className="admin-table-row promotions"
                    role="row"
                    whileHover={{ y: -1 }}
                    onClick={() => openEdit(promo)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div role="cell" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(promo.id)}
                        onChange={(e) => {
                          const next = new Set(selected);
                          if (e.target.checked) next.add(promo.id);
                          else next.delete(promo.id);
                          setSelected(next);
                        }}
                      />
                    </div>
                    <div role="cell">
                      <p className="admin-bold promo-name">{promo.name}</p>
                      <p className="admin-muted promo-code">{promo.code}</p>
                      <p className="admin-muted small">{promo.storeName || 'Store không xác định'}</p>
                    </div>
                    <div role="cell">{discountTypeLabel(promo.discountType)}</div>
                    <div role="cell">
                      <p className="admin-bold">
                        {promo.discountType === 'percent' ? `${promo.discountValue}%` : formatCurrency(promo.discountValue)}
                      </p>
                    </div>
                    <div role="cell">Đơn từ {formatCurrency(promo.minOrderValue)}</div>
                    <div role="cell">
                      <p className="admin-bold">{promo.usedCount}/{promo.totalIssued}</p>
                      <div className="promo-progress-track"><span style={{ width: `${usedPercent}%` }} /></div>
                    </div>
                    <div role="cell" className="admin-muted">{formatDate(promo.startDate)} - {formatDate(promo.endDate)}</div>
                    <div role="cell"><span className={`admin-pill ${promotionStatusClass(currentStatus)}`}>{promotionStatusLabel(currentStatus)}</span></div>
                    <div role="cell" className="admin-actions" onClick={(e) => e.stopPropagation()}>
                      <button className="admin-icon-btn subtle" onClick={() => openEdit(promo)}><Pencil size={16} /></button>
                      <button className="admin-icon-btn subtle" onClick={() => void togglePause(promo)}>
                        {promo.status === 'running' ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button className="admin-icon-btn subtle danger-icon" onClick={() => setDeleteIds([promo.id])}><Trash2 size={16} /></button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
          {!isLoading && filteredItems.length > 0 && (
            <div className="table-footer">
              <span className="table-footer-meta">Hiển thị {startIndex}-{endIndex} của {filteredItems.length} chiến dịch</span>
              <div className="pagination">
                <button className="page-btn" onClick={prev} disabled={page === 1}>Trước</button>
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button key={idx + 1} className={`page-btn ${page === idx + 1 ? 'active' : ''}`} onClick={() => setPage(idx + 1)}>
                    {idx + 1}
                  </button>
                ))}
                <button className="page-btn" onClick={next} disabled={page === totalPages}>Tiếp</button>
              </div>
            </div>
          )}
        </div>
      </section>

      <AdminConfirmDialog
        open={Boolean(deleteIds?.length)}
        title="Xóa chiến dịch"
        description="Bạn chắc chắn muốn xóa chiến dịch đã chọn? Hành động này không thể hoàn tác."
        selectedNoun="chiến dịch"
        confirmLabel="Xóa chiến dịch"
        danger
        onCancel={() => setDeleteIds(null)}
        onConfirm={() => void deleteSelected()}
      />

      <Drawer open={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} className="promo-drawer">
        <div className="drawer-header">
          <div>
            <p className="drawer-eyebrow">Chiến dịch nền tảng</p>
            <h3>{editingId ? 'Cập nhật chiến dịch toàn sàn' : 'Tạo chiến dịch toàn sàn'}</h3>
          </div>
          <button className="admin-icon-btn" onClick={() => setIsDrawerOpen(false)} aria-label="Đóng"><X size={16} /></button>
        </div>
        <div className="drawer-body">
          <section className="drawer-section">
            <h4>Thông tin</h4>
            <div className="form-grid">
              <label className="form-field">
                <span>Gian hàng áp dụng</span>
                <select value={form.storeId} onChange={(e) => setForm((prev) => ({ ...prev, storeId: e.target.value }))}>
                  <option value="">Chọn gian hàng</option>
                  {selectableStores.length > 0 && (
                    <option value={ALL_MARKETPLACE_STORE} disabled={Boolean(editingId)}>
                      Toàn sàn (mọi gian hàng đã duyệt)
                    </option>
                  )}
                  {selectableStores.map((store) => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Tên chiến dịch</span>
                <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Mã voucher</span>
                <input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))} />
              </label>
              <label className="form-field full">
                <span>Mô tả chiến dịch</span>
                <textarea rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
              </label>
            </div>
          </section>
          <section className="drawer-section">
            <h4>Giảm giá</h4>
            <div className="form-grid">
              <label className="form-field">
                <span>Loại giảm giá</span>
                <select value={form.discountType} onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value as AdminPromotionDiscountType }))}>
                  <option value="percent">Giảm %</option>
                  <option value="fixed">Giảm tiền</option>
                </select>
              </label>
              <label className="form-field">
                <span>Giá trị giảm</span>
                <input type="number" value={form.discountValue} onChange={(e) => setForm((prev) => ({ ...prev, discountValue: Number(e.target.value) || 0 }))} />
              </label>
              <label className="form-field">
                <span>Đơn tối thiểu</span>
                <input type="number" value={form.minOrderValue} onChange={(e) => setForm((prev) => ({ ...prev, minOrderValue: Number(e.target.value) || 0 }))} />
              </label>
              <label className="form-field">
                <span>Tổng số lượng phát hành</span>
                <input type="number" value={form.totalIssued} onChange={(e) => setForm((prev) => ({ ...prev, totalIssued: Number(e.target.value) || 0 }))} />
              </label>
              <label className="form-field">
                <span>Ngày bắt đầu</span>
                <input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Ngày kết thúc</span>
                <input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
              </label>
              <label className="form-field">
                <span>Trạng thái</span>
                <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as AdminPromotionStatus }))}>
                  <option value="running">Đang chạy</option>
                  <option value="paused">Tạm dừng</option>
                  <option value="draft">Nháp</option>
                </select>
              </label>
            </div>
          </section>
        </div>
        <div className="drawer-footer">
          <button className="admin-ghost-btn" onClick={() => setIsDrawerOpen(false)}>Hủy</button>
          <button className="admin-primary-btn" onClick={() => void savePromotion()} disabled={isSubmitting}>Lưu chiến dịch</button>
        </div>
      </Drawer>

      {toast && <div className="toast success">{toast}</div>}
    </AdminLayout>
  );
};

export default AdminPromotions;
