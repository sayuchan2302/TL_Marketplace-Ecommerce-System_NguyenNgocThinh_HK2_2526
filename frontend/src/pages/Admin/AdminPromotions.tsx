import './Admin.css';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, Plus, Ticket, Pencil, Pause, Play, X, Tag, Link2, Trash2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { AdminStateBlock, AdminTableSkeleton } from './AdminStateBlocks';
import AdminConfirmDialog from './AdminConfirmDialog';
import { useAdminListState } from './useAdminListState';
import { ADMIN_VIEW_KEYS } from './adminListView';
import { useAdminViewState } from './useAdminViewState';
import { useAdminToast } from './useAdminToast';
import { ADMIN_ACTION_TITLES, ADMIN_COMMON_LABELS } from './adminUiLabels';
import {
  promotionStatusClass,
  promotionStatusLabel,
  type PromotionStatus,
} from './adminStatusMaps';
import { ADMIN_TOAST_MESSAGES } from './adminMessages';
import { ADMIN_TEXT } from './adminText';

type DiscountType = 'percent' | 'fixed';

interface Promotion {
  id: string;
  name: string;
  code: string;
  description: string;
  discountType: DiscountType;
  discountValue: number;
  maxDiscount: number;
  minOrderValue: number;
  userLimit: number;
  totalIssued: number;
  usedCount: number;
  startDate: string;
  endDate: string;
  status: PromotionStatus;
}

interface PromotionDeleteConfirmState {
  ids: string[];
  selectedItems?: string[];
  title: string;
  description: string;
  confirmLabel: string;
}

const initialPromotions: Promotion[] = [
  {
    id: 'pr-001',
    name: 'Summer Flash Sale',
    code: 'SUMMER20',
    description: 'Chiến dịch hè giảm sâu cho nhóm sản phẩm bán chạy.',
    discountType: 'percent',
    discountValue: 20,
    maxDiscount: 200000,
    minOrderValue: 500000,
    userLimit: 2,
    totalIssued: 3000,
    usedCount: 1820,
    startDate: '2026-05-01',
    endDate: '2026-05-31',
    status: 'running',
  },
  {
    id: 'pr-002',
    name: 'Welcome New User',
    code: 'HELLO100K',
    description: 'Voucher chào mừng khách hàng mới.',
    discountType: 'fixed',
    discountValue: 100000,
    maxDiscount: 100000,
    minOrderValue: 699000,
    userLimit: 1,
    totalIssued: 5000,
    usedCount: 4960,
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    status: 'expired',
  },
  {
    id: 'pr-003',
    name: 'Weekend Promo',
    code: 'WKND50',
    description: 'Ưu đãi cuối tuần cho toàn bộ danh mục.',
    discountType: 'fixed',
    discountValue: 50000,
    maxDiscount: 50000,
    minOrderValue: 399000,
    userLimit: 3,
    totalIssued: 4500,
    usedCount: 820,
    startDate: '2026-06-01',
    endDate: '2026-07-30',
    status: 'paused',
  },
];

const emptyPromotion: Promotion = {
  id: '',
  name: '',
  code: '',
  description: '',
  discountType: 'percent',
  discountValue: 10,
  maxDiscount: 100000,
  minOrderValue: 500000,
  userLimit: 1,
  totalIssued: 1000,
  usedCount: 0,
  startDate: '',
  endDate: '',
  status: 'paused',
};

const formatCurrencyVnd = (value: number) => `${value.toLocaleString('vi-VN')} đ`;
const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('vi-VN');
};

const discountTypeLabel = (type: DiscountType) => (type === 'percent' ? 'Giảm theo %' : 'Giảm tiền mặt');

const deriveStatus = (promotion: Promotion): PromotionStatus => {
  if (promotion.status === 'paused') return 'paused';
  const startDate = new Date(promotion.startDate);
  const endDate = new Date(promotion.endDate);
  if (Number.isNaN(endDate.getTime())) return 'paused';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!Number.isNaN(startDate.getTime())) {
    startDate.setHours(0, 0, 0, 0);
    if (startDate > today) return 'paused';
  }
  endDate.setHours(0, 0, 0, 0);
  if (endDate < today) return 'expired';
  return 'running';
};

const canActivatePromotion = (promotion: Promotion) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(promotion.startDate);
  const endDate = new Date(promotion.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { ok: false as const, error: 'Lịch chạy chiến dịch không hợp lệ.' };
  }
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  if (endDate < today) {
    return { ok: false as const, error: 'Chiến dịch đã hết hạn, không thể kích hoạt lại.' };
  }
  if (startDate > today) {
    return { ok: false as const, error: 'Chiến dịch chưa đến ngày bắt đầu, chỉ có thể để trạng thái tạm dừng.' };
  }
  return { ok: true as const };
};

const validatePromotionForm = (form: Promotion, rows: Promotion[], editingId: string | null) => {
  const errors: Partial<Record<'name' | 'code' | 'discountValue' | 'maxDiscount' | 'minOrderValue' | 'userLimit' | 'totalIssued' | 'startDate' | 'endDate', string>> = {};

  if (!form.name.trim()) errors.name = 'Tên chiến dịch không được để trống.';
  if (!form.code.trim()) {
    errors.code = 'Mã voucher không được để trống.';
  } else if (!/^[A-Z0-9-]{4,24}$/.test(form.code)) {
    errors.code = 'Mã chỉ gồm chữ in hoa, số, dấu gạch ngang (4-24 ký tự).';
  } else {
    const duplicated = rows.some((item) => item.code === form.code && item.id !== editingId);
    if (duplicated) errors.code = 'Mã voucher đã tồn tại.';
  }

  if (form.discountValue <= 0) errors.discountValue = 'Giá trị giảm phải lớn hơn 0.';
  if (form.discountType === 'percent' && form.discountValue > 100) errors.discountValue = 'Giảm theo % không được vượt quá 100%.';

  if (form.maxDiscount <= 0) errors.maxDiscount = 'Giảm tối đa phải lớn hơn 0.';
  if (form.discountType === 'fixed' && form.maxDiscount < form.discountValue) {
    errors.maxDiscount = 'Giảm tối đa phải lớn hơn hoặc bằng giá trị giảm tiền mặt.';
  }

  if (form.minOrderValue <= 0) errors.minOrderValue = 'Đơn tối thiểu phải lớn hơn 0.';
  if (form.userLimit < 1) errors.userLimit = 'Giới hạn mỗi user tối thiểu là 1.';
  if (form.totalIssued < 1) errors.totalIssued = 'Tổng số lượng phát hành tối thiểu là 1.';
  if (form.usedCount > form.totalIssued) errors.totalIssued = 'Tổng phát hành phải lớn hơn hoặc bằng số lượng đã dùng.';

  if (!form.startDate) errors.startDate = 'Vui lòng chọn ngày bắt đầu.';
  if (!form.endDate) errors.endDate = 'Vui lòng chọn ngày kết thúc.';
  if (form.startDate && form.endDate) {
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (end < start) errors.endDate = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
  }

  return errors;
};

const AdminPromotions = () => {
  const t = ADMIN_TEXT.promotions;
  const c = ADMIN_TEXT.common;
  const view = useAdminViewState({
    storageKey: ADMIN_VIEW_KEYS.promotions,
    path: '/admin/promotions',
    validStatusKeys: ['all', 'running', 'paused', 'expired'],
    defaultStatus: 'all',
  });
  const [rows, setRows] = useState<Promotion[]>(initialPromotions);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const statusFilter: 'all' | PromotionStatus =
    view.status === 'running' || view.status === 'paused' || view.status === 'expired' || view.status === 'all'
      ? view.status
      : 'all';
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Promotion>(emptyPromotion);
  const [deleteConfirm, setDeleteConfirm] = useState<PromotionDeleteConfirmState | null>(null);
  const { toast, pushToast } = useAdminToast();

  const {
    search,
    isLoading,
    filteredItems: filtered,
    pagedItems: pagedPromotions,
    page,
    totalPages,
    startIndex,
    endIndex,
    next,
    prev,
    setPage,
  } = useAdminListState<Promotion>({
    items: rows,
    pageSize: 7,
    searchValue: view.search,
    onSearchChange: view.setSearch,
    pageValue: view.page,
    onPageChange: view.setPage,
    getSearchText: (item) => `${item.name} ${item.code} ${item.description}`,
    filterPredicate: (item) => {
      const currentStatus = deriveStatus(item);
      return statusFilter === 'all' || currentStatus === statusFilter;
    },
    loadingDeps: [statusFilter],
  });

  const changeStatusFilter = (nextStatus: 'all' | PromotionStatus) => {
    view.setStatus(nextStatus);
  };

  const handleSearchChange = (value: string) => {
    view.setSearch(value);
  };

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
    setDeleteConfirm(null);
    view.resetCurrentView();
    pushToast(ADMIN_TOAST_MESSAGES.promotions.resetView);
  };

  const hasViewContext = statusFilter !== 'all' || Boolean(search.trim()) || view.page > 1;
  const statusFilterLabel = statusFilter === 'all' ? t.tabs.all : statusFilter === 'running' ? t.tabs.running : statusFilter === 'paused' ? t.tabs.paused : t.tabs.expired;

  const stats = useMemo(() => {
    const statusRows = rows.map((item) => ({ ...item, derivedStatus: deriveStatus(item) }));
    const running = statusRows.filter((item) => item.derivedStatus === 'running').length;
    const paused = statusRows.filter((item) => item.derivedStatus === 'paused').length;
    const expired = statusRows.filter((item) => item.derivedStatus === 'expired').length;
    const totalIssued = statusRows.reduce((sum, item) => sum + item.totalIssued, 0);
    const totalUsed = statusRows.reduce((sum, item) => sum + item.usedCount, 0);
    const usageRate = totalIssued > 0 ? Math.round((totalUsed / totalIssued) * 100) : 0;
    return { running, paused, expired, usageRate };
  }, [rows]);

  const tabCounts = {
    all: rows.length,
    running: stats.running,
    paused: stats.paused,
    expired: stats.expired,
  } as const;

  const formErrors = useMemo(() => validatePromotionForm(form, rows, editingId), [form, rows, editingId]);
  const hasFormError = Object.keys(formErrors).length > 0;
  const isCodeDuplicated = Boolean(formErrors.code && formErrors.code.includes('tồn tại'));

  useEffect(() => {
    setSelected(new Set());
    setDeleteConfirm(null);
  }, [statusFilter, search]);

  const openCreateDrawer = () => {
    setEditingId(null);
    setForm(emptyPromotion);
    setIsDrawerOpen(true);
  };

  const openEditDrawer = (promotion: Promotion) => {
    setEditingId(promotion.id);
    setForm({
      ...promotion,
      status: promotion.status === 'expired' ? 'running' : promotion.status,
    });
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
    setEditingId(null);
  };

  const savePromotion = () => {
    const errors = validatePromotionForm(form, rows, editingId);
    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      if (firstError) pushToast(firstError);
      return;
    }

    if (editingId) {
      setRows((prev) => prev.map((item) => (item.id === editingId ? { ...form, id: editingId } : item)));
      pushToast(ADMIN_TOAST_MESSAGES.promotions.updated);
    } else {
      const newPromotion: Promotion = {
        ...form,
        id: `pr-${Date.now()}`,
        status: form.status,
      };
      setRows((prev) => [newPromotion, ...prev]);
      pushToast(ADMIN_TOAST_MESSAGES.promotions.created);
    }

    closeDrawer();
  };

  const togglePause = (id: string) => {
    const target = rows.find((item) => item.id === id);
    if (!target) return;
    if (target.status === 'paused') {
      const activation = canActivatePromotion(target);
      if (!activation.ok) {
        pushToast(activation.error);
        return;
      }
    }

    setRows((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: item.status === 'paused' ? 'running' : 'paused',
            }
          : item,
      ),
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(filtered.map((item) => item.id)));
      return;
    }
    setSelected(new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  const pauseSelected = () => {
    const selectedIds = new Set(selected);
    const affected = rows.filter((item) => selectedIds.has(item.id) && item.status !== 'paused').length;
    if (affected === 0) {
      pushToast(ADMIN_TOAST_MESSAGES.promotions.noEligiblePauseBulk);
      return;
    }

    setRows((prev) => prev.map((item) => (selectedIds.has(item.id) ? { ...item, status: 'paused' } : item)));
    setSelected(new Set());
    pushToast(ADMIN_TOAST_MESSAGES.promotions.bulkPaused(affected));
  };

  const deleteSelected = () => {
    if (!deleteConfirm || deleteConfirm.ids.length === 0) {
      setDeleteConfirm(null);
      return;
    }
    const selectedIds = new Set(deleteConfirm.ids);
    setRows((prev) => prev.filter((item) => !selectedIds.has(item.id)));
    setSelected(new Set());
    setDeleteConfirm(null);
    pushToast(ADMIN_TOAST_MESSAGES.promotions.bulkDeleted(selectedIds.size));
  };

  const requestDeleteSelected = () => {
    if (selected.size === 0) return;
    const selectedRows = rows.filter((item) => selected.has(item.id));
    setDeleteConfirm({
      ids: selectedRows.map((item) => item.id),
      selectedItems: selectedRows.map((item) => `${item.name} (${item.code})`),
      title: 'Xóa chiến dịch đã chọn',
      description: 'Bạn có chắc chắn muốn xóa các chiến dịch đã chọn? Hành động này không thể hoàn tác.',
      confirmLabel: 'Xóa chiến dịch',
    });
  };

  const requestDeleteOne = (promotion: Promotion) => {
    setDeleteConfirm({
      ids: [promotion.id],
      title: 'Xóa chiến dịch',
      description: 'Bạn có chắc chắn muốn xóa chiến dịch này? Hành động này không thể hoàn tác.',
      confirmLabel: 'Xóa chiến dịch',
    });
  };

  return (
    <AdminLayout
      title={t.title}
      actions={
        <>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} value={search} onChange={(e) => handleSearchChange(e.target.value)} />
          </div>
          <button type="button" className="admin-ghost-btn" onClick={() => pushToast(ADMIN_TOAST_MESSAGES.promoTypeFilterComingSoon)}><Tag size={16} /> {t.promoType}</button>
          <button className="admin-ghost-btn" onClick={shareCurrentView}><Link2 size={16} /> {ADMIN_COMMON_LABELS.shareView}</button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>{ADMIN_COMMON_LABELS.resetView}</button>
          <button className="admin-primary-btn" onClick={openCreateDrawer}><Plus size={16} /> {t.create}</button>
        </>
      }
    >
      <div className="admin-tabs">
        <button className={`admin-tab ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => changeStatusFilter('all')}>
          <span>{t.tabs.all}</span>
          <span className="admin-tab-count">{tabCounts.all}</span>
        </button>
        <button className={`admin-tab ${statusFilter === 'running' ? 'active' : ''}`} onClick={() => changeStatusFilter('running')}>
          <span>{t.tabs.running}</span>
          <span className="admin-tab-count">{tabCounts.running}</span>
        </button>
        <button className={`admin-tab ${statusFilter === 'paused' ? 'active' : ''}`} onClick={() => changeStatusFilter('paused')}>
          <span>{t.tabs.paused}</span>
          <span className="admin-tab-count">{tabCounts.paused}</span>
        </button>
        <button className={`admin-tab ${statusFilter === 'expired' ? 'active' : ''}`} onClick={() => changeStatusFilter('expired')}>
          <span>{t.tabs.expired}</span>
          <span className="admin-tab-count">{tabCounts.expired}</span>
        </button>
      </div>

      {hasViewContext && (
        <div className="admin-view-summary">
          <span className="summary-chip">{c.statusLabel}: {statusFilterLabel}</span>
          {search.trim() && <span className="summary-chip">{c.keyword}: {search.trim()}</span>}
          <button className="summary-clear" onClick={resetCurrentView}>{c.clearFilters}</button>
        </div>
      )}

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <h2>
              <Ticket size={16} /> {t.panelTitle}
            </h2>
            <span className="admin-muted">{filtered.length} {t.selectedNoun}</span>
          </div>

          {isLoading ? (
            <AdminTableSkeleton columns={9} rows={6} />
          ) : filtered.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? t.empty.searchTitle : t.empty.defaultTitle}
              description={search.trim() ? t.empty.searchDescription : t.empty.defaultDescription}
              actionLabel={ADMIN_COMMON_LABELS.resetFilters}
              onAction={resetCurrentView}
            />
          ) : (
          <div className="admin-table" role="table" aria-label={t.tableAria}>
            <div className="admin-table-row admin-table-head promotions" role="row">
              <div role="columnheader"><input type="checkbox" aria-label="Chọn tất cả" checked={selected.size === filtered.length && filtered.length > 0} onChange={(e) => toggleSelectAll(e.target.checked)} /></div>
              <div role="columnheader">{t.columns.voucherName}</div>
              <div role="columnheader">{t.columns.discountType}</div>
              <div role="columnheader">{t.columns.value}</div>
              <div role="columnheader">{t.columns.condition}</div>
              <div role="columnheader">{t.columns.quantity}</div>
              <div role="columnheader">{t.columns.schedule}</div>
              <div role="columnheader">{t.columns.status}</div>
              <div role="columnheader">{t.columns.actions}</div>
            </div>

            {pagedPromotions.map((promo, idx) => {
              const usedPercent = promo.totalIssued > 0 ? Math.min(100, Math.round((promo.usedCount / promo.totalIssued) * 100)) : 0;
              const currentStatus = deriveStatus(promo);
              return (
                <motion.div
                  key={promo.id}
                  className="admin-table-row promotions"
                  role="row"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.18) }}
                  whileHover={{ y: -1 }}
                  onClick={() => openEditDrawer(promo)}
                  style={{ cursor: 'pointer' }}
                >
                  <div role="cell" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Chọn ${promo.code}`} checked={selected.has(promo.id)} onChange={(e) => toggleOne(promo.id, e.target.checked)} /></div>
                  <div role="cell">
                    <p className="admin-bold promo-name">{promo.name}</p>
                    <p className="admin-muted promo-code">{promo.code}</p>
                  </div>
                  <div role="cell">{discountTypeLabel(promo.discountType)}</div>
                  <div role="cell" className="promo-value-cell">
                    <p className="admin-bold">
                      {promo.discountType === 'percent' ? `${promo.discountValue}%` : formatCurrencyVnd(promo.discountValue)}
                    </p>
                    <p className="admin-muted small">Tối đa {formatCurrencyVnd(promo.maxDiscount)}</p>
                  </div>
                  <div role="cell" className="promo-condition">Đơn &gt; {formatCurrencyVnd(promo.minOrderValue)}</div>
                  <div role="cell">
                    <p className="admin-bold">{promo.usedCount}/{promo.totalIssued}</p>
                    <div className="promo-progress-track"><span style={{ width: `${usedPercent}%` }} /></div>
                  </div>
                  <div role="cell" className="admin-muted">{formatDate(promo.startDate)} - {formatDate(promo.endDate)}</div>
                  <div role="cell"><span className={`admin-pill ${promotionStatusClass(currentStatus)}`}>{promotionStatusLabel(currentStatus)}</span></div>
                  <div role="cell" className="admin-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="admin-icon-btn subtle" title={ADMIN_ACTION_TITLES.edit} aria-label={ADMIN_ACTION_TITLES.edit} onClick={() => openEditDrawer(promo)}><Pencil size={16} /></button>
                    <button className="admin-icon-btn subtle" title={promo.status === 'paused' ? ADMIN_ACTION_TITLES.resumeCampaign : ADMIN_ACTION_TITLES.pauseCampaign} aria-label={promo.status === 'paused' ? ADMIN_ACTION_TITLES.resumeCampaign : ADMIN_ACTION_TITLES.pauseCampaign} onClick={() => togglePause(promo.id)}>
                      {promo.status === 'paused' ? <Play size={16} /> : <Pause size={16} />}
                    </button>
                    <button className="admin-icon-btn subtle danger-icon" title={ADMIN_ACTION_TITLES.delete} aria-label={ADMIN_ACTION_TITLES.delete} onClick={() => requestDeleteOne(promo)}><Trash2 size={16} /></button>
                  </div>
                </motion.div>
              );
            })}
          </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="table-footer">
              <span className="table-footer-meta">{c.showing(startIndex, endIndex, filtered.length, t.selectedNoun)}</span>
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
                <button className="admin-ghost-btn" onClick={pauseSelected}>{t.floatingActions.pauseSelected}</button>
                <button className="admin-ghost-btn danger" onClick={requestDeleteSelected}>{t.floatingActions.deleteSelected}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AdminConfirmDialog
        open={Boolean(deleteConfirm)}
        title={deleteConfirm?.title || 'Xóa chiến dịch'}
        description={deleteConfirm?.description || ''}
        selectedItems={deleteConfirm?.selectedItems}
        selectedNoun={t.selectedNoun}
        confirmLabel={deleteConfirm?.confirmLabel || 'Xóa chiến dịch'}
        danger
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={deleteSelected}
      />

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div className="drawer-overlay" onClick={closeDrawer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} />
            <motion.div className="drawer promo-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.25, ease: 'easeOut' }}>
              <div className="drawer-header">
                <div>
                  <p className="drawer-eyebrow">{t.drawer.eyebrow}</p>
                  <h3>{editingId ? t.drawer.editTitle : t.drawer.createTitle}</h3>
                </div>
                <button className="admin-icon-btn" onClick={closeDrawer} aria-label={ADMIN_ACTION_TITLES.close}><X size={16} /></button>
              </div>

              <div className="drawer-body">
                <section className="drawer-section">
                  <h4>{t.drawer.section1}</h4>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Tên chiến dịch</span>
                      <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t.drawer.placeholders.name} />
                    </label>
                    <label className="form-field">
                      <span>Mã voucher</span>
                      <input value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase().replace(/\s+/g, '') }))} placeholder={t.drawer.placeholders.code} />
                      {isCodeDuplicated && <small className="promo-field-error">Mã voucher này đã tồn tại trong hệ thống.</small>}
                      {formErrors.code && !isCodeDuplicated && <small className="promo-field-error">{formErrors.code}</small>}
                    </label>
                    <label className="form-field full">
                      <span>Mô tả chiến dịch</span>
                      <textarea rows={3} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t.drawer.placeholders.description} />
                    </label>
                  </div>
                </section>

                <section className="drawer-section">
                  <h4>{t.drawer.section2}</h4>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Loại giảm giá</span>
                      <select value={form.discountType} onChange={(e) => setForm((prev) => ({ ...prev, discountType: e.target.value as DiscountType }))}>
                        <option value="percent">Giảm theo %</option>
                        <option value="fixed">Giảm tiền mặt</option>
                      </select>
                    </label>
                    <label className="form-field">
                      <span>Giá trị</span>
                      <input type="number" value={form.discountValue} onChange={(e) => setForm((prev) => ({ ...prev, discountValue: Number(e.target.value) || 0 }))} />
                      {formErrors.discountValue && <small className="promo-field-error">{formErrors.discountValue}</small>}
                    </label>
                    <label className="form-field">
                      <span>Giảm tối đa (VNĐ)</span>
                      <input type="number" value={form.maxDiscount} onChange={(e) => setForm((prev) => ({ ...prev, maxDiscount: Number(e.target.value) || 0 }))} />
                      {formErrors.maxDiscount && <small className="promo-field-error">{formErrors.maxDiscount}</small>}
                    </label>
                  </div>
                </section>

                <section className="drawer-section">
                  <h4>{t.drawer.section3}</h4>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Đơn tối thiểu (VNĐ)</span>
                      <input type="number" value={form.minOrderValue} onChange={(e) => setForm((prev) => ({ ...prev, minOrderValue: Number(e.target.value) || 0 }))} />
                      {formErrors.minOrderValue && <small className="promo-field-error">{formErrors.minOrderValue}</small>}
                    </label>
                    <label className="form-field">
                      <span>Giới hạn mỗi user</span>
                      <input type="number" value={form.userLimit} onChange={(e) => setForm((prev) => ({ ...prev, userLimit: Number(e.target.value) || 1 }))} />
                      {formErrors.userLimit && <small className="promo-field-error">{formErrors.userLimit}</small>}
                    </label>
                    <label className="form-field">
                      <span>Tổng số lượng phát hành</span>
                      <input type="number" value={form.totalIssued} onChange={(e) => setForm((prev) => ({ ...prev, totalIssued: Number(e.target.value) || 0 }))} />
                      {formErrors.totalIssued && <small className="promo-field-error">{formErrors.totalIssued}</small>}
                    </label>
                  </div>
                </section>

                <section className="drawer-section">
                  <h4>{t.drawer.section4}</h4>
                  <div className="form-grid">
                    <label className="form-field">
                      <span>Ngày bắt đầu</span>
                      <input type="date" value={form.startDate} onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))} />
                      {formErrors.startDate && <small className="promo-field-error">{formErrors.startDate}</small>}
                    </label>
                    <label className="form-field">
                      <span>Ngày kết thúc</span>
                      <input type="date" value={form.endDate} onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))} />
                      {formErrors.endDate && <small className="promo-field-error">{formErrors.endDate}</small>}
                    </label>
                    <label className="form-field">
                      <span>Vận hành chiến dịch</span>
                      <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as PromotionStatus }))}>
                        <option value="running">Đang chạy</option>
                        <option value="paused">Tạm dừng</option>
                      </select>
                      <small className="admin-muted">Trạng thái Hết hạn sẽ tự động cập nhật theo ngày kết thúc.</small>
                    </label>
                  </div>
                </section>
              </div>

              <div className="drawer-footer">
                <button className="admin-ghost-btn" onClick={closeDrawer}>{t.drawer.cancel}</button>
                <button className="admin-primary-btn" onClick={savePromotion} disabled={hasFormError}>{editingId ? t.drawer.save : t.drawer.create}</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {toast && <div className="toast success">{toast}</div>}
    </AdminLayout>
  );
};

export default AdminPromotions;
