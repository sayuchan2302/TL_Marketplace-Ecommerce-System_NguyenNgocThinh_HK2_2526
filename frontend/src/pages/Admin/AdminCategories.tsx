import './Admin.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Layers, GripVertical, Search, X, Trash2, Link2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import AdminLayout from './AdminLayout';
import { AdminStateBlock, AdminTableSkeleton } from './AdminStateBlocks';
import AdminConfirmDialog from './AdminConfirmDialog';
import { useAdminListState } from './useAdminListState';
import { ADMIN_VIEW_KEYS } from './adminListView';
import { useAdminViewState } from './useAdminViewState';
import { useAdminToast } from './useAdminToast';
import { ADMIN_ACTION_TITLES, ADMIN_COMMON_LABELS } from './adminUiLabels';
import { ADMIN_TOAST_MESSAGES } from './adminMessages';
import { ADMIN_TEXT } from './adminText';

interface Category {
  id: string;
  name: string;
  slug: string;
  parentId: string;
  count: number;
  status: 'visible' | 'hidden';
  order: number;
  showOnMenu: boolean;
  image: string;
  description?: string;
}

interface DeleteConfirmState {
  ids: string[];
  selectedItems?: string[];
  selectedNoun: string;
  title: string;
  description: string;
  confirmLabel: string;
  undoMessage: string;
  blockedCount?: number;
}

type CategoryFormErrors = {
  name?: string;
  slug?: string;
  order?: string;
  parent?: string;
};

const initialCategories: Category[] = [
  { id: 'c1', name: 'Áo Polo', slug: 'ao-polo', parentId: '', count: 32, status: 'visible', order: 1, showOnMenu: true, image: 'https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?auto=format&fit=crop&w=200&q=80' },
  { id: 'c2', name: 'Quần Jeans', slug: 'quan-jeans', parentId: '', count: 24, status: 'visible', order: 2, showOnMenu: true, image: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?auto=format&fit=crop&w=200&q=80' },
  { id: 'c3', name: 'Áo Thun', slug: 'ao-thun', parentId: 'c1', count: 18, status: 'hidden', order: 3, showOnMenu: false, image: 'https://images.unsplash.com/photo-1475180098004-ca77a66827be?auto=format&fit=crop&w=200&q=80' },
];

const validCategoryFilters = new Set(['all', 'visible', 'hidden', 'menu']);

const AdminCategories = () => {
  const t = ADMIN_TEXT.categories;
  const c = ADMIN_TEXT.common;
  const view = useAdminViewState({
    storageKey: ADMIN_VIEW_KEYS.categories,
    path: '/admin/categories',
    validStatusKeys: ['all', 'visible', 'hidden', 'menu'],
    defaultStatus: 'all',
  });
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [showCategoryDrawer, setShowCategoryDrawer] = useState(false);
  const emptyCategory: Category = { id: '', name: '', slug: '', parentId: '', count: 0, status: 'visible', order: 0, showOnMenu: false, image: '' };
  const [categoryForm, setCategoryForm] = useState<Category>(emptyCategory);
  const [formErrors, setFormErrors] = useState<CategoryFormErrors>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const activeFilter = validCategoryFilters.has(view.status) ? (view.status as 'all' | 'visible' | 'hidden' | 'menu') : 'all';
  const [undoPayload, setUndoPayload] = useState<{ items: Category[]; message: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const { toast, pushToast } = useAdminToast();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const toSlug = (val: string) =>
    val
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');

  const parentNameById = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach(c => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const {
    search,
    isLoading,
    filteredItems: visibleCategories,
    page,
    totalPages,
    startIndex,
    endIndex,
    pagedItems: pagedCategories,
    next,
    prev,
    setPage,
  } = useAdminListState<Category>({
    items: categories,
    pageSize: 8,
    searchValue: view.search,
    onSearchChange: view.setSearch,
    pageValue: view.page,
    onPageChange: view.setPage,
    getSearchText: (c) => `${c.name} ${c.slug} ${parentNameById.get(c.parentId) || ''}`,
    filterPredicate: (c) => {
      if (activeFilter === 'visible') return c.status === 'visible';
      if (activeFilter === 'hidden') return c.status === 'hidden';
      if (activeFilter === 'menu') return c.showOnMenu && c.status === 'visible';
      return true;
    },
    sorters: {
      order: (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'vi'),
    },
    initialSortKey: 'order',
    loadingDeps: [activeFilter],
  });

  useEffect(() => {
    setSelected(new Set());
  }, [activeFilter]);

  useEffect(() => {
    if (!undoPayload) return;
    const timer = setTimeout(() => setUndoPayload(null), 5000);
    return () => clearTimeout(timer);
  }, [undoPayload]);

  const changeFilter = (nextFilter: 'all' | 'visible' | 'hidden' | 'menu') => {
    setSelected(new Set());
    view.setStatus(nextFilter);
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
    pushToast(ADMIN_TOAST_MESSAGES.categories.resetView);
  };

  const activeFilterLabel = activeFilter === 'all' ? t.tabs.all : activeFilter === 'visible' ? t.tabs.visible : activeFilter === 'hidden' ? t.tabs.hidden : t.tabs.menu;
  const hasViewContext = activeFilter !== 'all' || Boolean(search.trim()) || view.page > 1;
  const tabCounts = {
    all: categories.length,
    visible: categories.filter((category) => category.status === 'visible').length,
    hidden: categories.filter((category) => category.status === 'hidden').length,
    menu: categories.filter((category) => category.showOnMenu && category.status === 'visible').length,
  } as const;

  const getCategoryDeleteBlockReason = (category: Category) => {
    const hasChildren = categories.some((item) => item.parentId === category.id);
    if (hasChildren) return `Danh mục "${category.name}" còn danh mục con.`;
    if (category.count > 0) return `Danh mục "${category.name}" còn ${category.count} sản phẩm.`;
    return '';
  };

  const syncCategoryChanges = async (_next: Category[]) => {
    await new Promise(resolve => setTimeout(resolve, 160));
  };

  const applyOptimisticCategoryUpdate = useCallback(
    async (updater: (current: Category[]) => Category[], successMessage?: string, failMessage?: string) => {
      const snapshot = categories;
      const next = updater(snapshot);
      setCategories(next);
      try {
        await syncCategoryChanges(next);
        if (successMessage) pushToast(successMessage);
      } catch {
        setCategories(snapshot);
        pushToast(failMessage || ADMIN_TOAST_MESSAGES.categories.syncRollback);
      }
    },
    [categories],
  );

  const handleCatSlugChange = (val: string) => {
    const clean = toSlug(val);
    setCategoryForm(prev => ({ ...prev, slug: clean }));
    if (formErrors.slug) setFormErrors(prev => ({ ...prev, slug: undefined }));
  };

  const openNewCategory = () => {
    setCategoryForm(emptyCategory);
    setFormErrors({});
    setShowCategoryDrawer(true);
  };

  const openEditCategory = (id: string) => {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    setCategoryForm(cat);
    setFormErrors({});
    setShowCategoryDrawer(true);
  };

  const validateCategoryForm = (form: Category) => {
    const errors: CategoryFormErrors = {};
    if (!form.name.trim()) errors.name = 'Tên danh mục không được để trống.';

    const slugValue = toSlug(form.slug || form.name);
    if (!slugValue) {
      errors.slug = 'Slug không hợp lệ.';
    } else {
      const duplicated = categories.some(c => c.id !== form.id && c.slug === slugValue);
      if (duplicated) errors.slug = 'Slug đã tồn tại.';
    }

    if (form.order < 0) errors.order = 'Thứ tự hiển thị phải >= 0.';

    if (form.parentId && form.id) {
      const selfCategory = categories.find(c => c.id === form.id);
      if (selfCategory && form.parentId === selfCategory.id) errors.parent = 'Không thể chọn chính danh mục này làm cha.';

      let cursor = form.parentId;
      const visited = new Set<string>();
      while (cursor) {
        if (cursor === form.id) {
          errors.parent = 'Danh mục cha tạo vòng lặp. Vui lòng chọn danh mục khác.';
          break;
        }
        if (visited.has(cursor)) break;
        visited.add(cursor);
        cursor = categories.find(c => c.id === cursor)?.parentId || '';
      }
    }

    return errors;
  };

  const handleSaveCategory = () => {
    const normalizedForm: Category = {
      ...categoryForm,
      name: categoryForm.name.trim(),
      slug: toSlug(categoryForm.slug || categoryForm.name),
      order: Number.isFinite(categoryForm.order) ? Math.max(0, categoryForm.order) : 0,
      showOnMenu: categoryForm.status === 'hidden' ? false : categoryForm.showOnMenu,
    };

    const errors = validateCategoryForm(normalizedForm);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    void applyOptimisticCategoryUpdate(prev => {
      if (normalizedForm.id) {
        return prev.map(c => c.id === normalizedForm.id ? { ...normalizedForm } : c);
      }
      const newCat = { ...normalizedForm, id: `c-${Date.now()}` };
      return [...prev, newCat];
    }, normalizedForm.id ? 'Đã cập nhật danh mục' : 'Đã tạo danh mục mới');
    setFormErrors({});
    setShowCategoryDrawer(false);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelected(new Set(visibleCategories.map(c => c.id)));
    else setSelected(new Set());
  };

  const toggleOne = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    setSelected(next);
  };

  const requestBulkDelete = () => {
    const selectedCategories = categories.filter((item) => selected.has(item.id));
    const deletable = selectedCategories.filter((item) => !getCategoryDeleteBlockReason(item));
    const blocked = selectedCategories.filter((item) => Boolean(getCategoryDeleteBlockReason(item)));
    if (deletable.length === 0) {
      pushToast(ADMIN_TOAST_MESSAGES.categories.noDeletable);
      return;
    }
    setDeleteConfirm({
      ids: deletable.map((item) => item.id),
      selectedItems: deletable.map((item) => item.name),
      selectedNoun: t.selectedNoun,
      title: 'Xóa danh mục đã chọn',
      description: 'Bạn có chắc chắn muốn xóa các danh mục đã chọn? Hành động này không thể hoàn tác.',
      confirmLabel: 'Xóa danh mục',
      undoMessage: `Đã xóa ${deletable.length} danh mục`,
      blockedCount: blocked.length,
    });
  };

  const confirmDeleteCategories = () => {
    if (!deleteConfirm) return;
    const idsToDelete = new Set(deleteConfirm.ids);
    const deletedItems = categories.filter((item) => idsToDelete.has(item.id));
    void applyOptimisticCategoryUpdate(prev => prev.filter(c => !idsToDelete.has(c.id)), undefined, 'Xóa danh mục thất bại, đã hoàn tác.');
    setSelected(new Set());
    setUndoPayload({ items: deletedItems, message: deleteConfirm.undoMessage });
    if ((deleteConfirm.blockedCount || 0) > 0) {
      pushToast(ADMIN_TOAST_MESSAGES.categories.skippedBlocked(deleteConfirm.blockedCount || 0));
    }
    setDeleteConfirm(null);
  };

  const bulkToggleStatus = () => {
    void applyOptimisticCategoryUpdate(
      prev => prev.map((c) => {
        if (!selected.has(c.id)) return c;
        if (c.status === 'visible') {
          return { ...c, status: 'hidden', showOnMenu: false };
        }
        return { ...c, status: 'visible' };
      }),
      'Đã cập nhật trạng thái danh mục đã chọn',
    );
    setSelected(new Set());
  };

  const restoreDeleted = () => {
    if (!undoPayload) return;
    setCategories(prev => {
      const currentIds = new Set(prev.map(c => c.id));
      const restored = undoPayload.items.filter(c => !currentIds.has(c.id));
      return [...prev, ...restored];
    });
    setUndoPayload(null);
  };

  const blockedParentIds = useMemo(() => {
    if (!categoryForm.id) return new Set<string>();
    const blocked = new Set<string>([categoryForm.id]);
    const queue = [categoryForm.id];
    while (queue.length > 0) {
      const current = queue.shift() as string;
      categories.forEach(c => {
        if (c.parentId === current && !blocked.has(c.id)) {
          blocked.add(c.id);
          queue.push(c.id);
        }
      });
    }
    return blocked;
  }, [categories, categoryForm.id]);

  const handleRowReorder = (sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;
    const ids = visibleCategories.map(c => c.id);
    const sourceIdx = ids.indexOf(sourceId);
    const targetIdx = ids.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;
    const nextIds = [...ids];
    const [moved] = nextIds.splice(sourceIdx, 1);
    nextIds.splice(targetIdx, 0, moved);

    void applyOptimisticCategoryUpdate(prev => {
      const orderMap = new Map<string, number>();
      nextIds.forEach((id, idx) => orderMap.set(id, idx + 1));
      return prev.map(c => (orderMap.has(c.id) ? { ...c, order: orderMap.get(c.id) as number } : c));
    }, 'Đã cập nhật thứ tự danh mục');
  };

  return (
    <AdminLayout
      title={t.title}
      actions={(
        <>
          <div className="admin-search">
            <Search size={16} />
            <input placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} value={search} onChange={e => handleSearchChange(e.target.value)} />
          </div>
          <button className="admin-ghost-btn" onClick={shareCurrentView}><Link2 size={16} /> {ADMIN_COMMON_LABELS.shareView}</button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>{ADMIN_COMMON_LABELS.resetView}</button>
          <button className="admin-primary-btn" onClick={openNewCategory}><Plus size={14} /> {t.addCategory}</button>
        </>
      )}
    >
      <div className="admin-tabs">
        <button className={`admin-tab ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => changeFilter('all')}>
          <span>{t.tabs.all}</span>
          <span className="admin-tab-count">{tabCounts.all}</span>
        </button>
        <button className={`admin-tab ${activeFilter === 'visible' ? 'active' : ''}`} onClick={() => changeFilter('visible')}>
          <span>{t.tabs.visible}</span>
          <span className="admin-tab-count">{tabCounts.visible}</span>
        </button>
        <button className={`admin-tab ${activeFilter === 'hidden' ? 'active' : ''}`} onClick={() => changeFilter('hidden')}>
          <span>{t.tabs.hidden}</span>
          <span className="admin-tab-count">{tabCounts.hidden}</span>
        </button>
        <button className={`admin-tab ${activeFilter === 'menu' ? 'active' : ''}`} onClick={() => changeFilter('menu')}>
          <span>{t.tabs.menu}</span>
          <span className="admin-tab-count">{tabCounts.menu}</span>
        </button>
      </div>

      {hasViewContext && (
        <div className="admin-view-summary">
          <span className="summary-chip">{c.statusLabel}: {activeFilterLabel}</span>
          {search.trim() && <span className="summary-chip">{c.keyword}: {search.trim()}</span>}
          <button className="summary-clear" onClick={resetCurrentView}>{c.clearFilters}</button>
        </div>
      )}

      <section className="admin-panels single">
        <div className="admin-panel">
          {isLoading ? (
            <AdminTableSkeleton columns={8} rows={6} />
          ) : visibleCategories.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? t.empty.searchTitle : t.empty.defaultTitle}
                description={search.trim() ? t.empty.searchDescription : t.empty.defaultDescription}
                actionLabel={ADMIN_COMMON_LABELS.resetFilters}
                onAction={resetCurrentView}
              />
          ) : (
          <div className="admin-table" role="table" aria-label={t.tableAria}>
            <div className="admin-table-row categories admin-table-head" role="row">
              <div role="columnheader"><input type="checkbox" aria-label="Chọn tất cả" checked={selected.size === visibleCategories.length && visibleCategories.length > 0} onChange={e => toggleSelectAll(e.target.checked)} /></div>
              <div role="columnheader">{t.columns.image}</div>
              <div role="columnheader">{t.columns.name}</div>
              <div role="columnheader">{t.columns.parent}</div>
              <div role="columnheader">{t.columns.productCount}</div>
              <div role="columnheader">{t.columns.order}</div>
              <div role="columnheader">{t.columns.status}</div>
              <div role="columnheader">{t.columns.actions}</div>
            </div>
            {pagedCategories.map((cat, idx) => (
              <motion.div
                key={cat.id}
                className={`admin-table-row categories category-row ${cat.status === 'hidden' ? 'row-muted' : ''} ${draggingId === cat.id ? 'dragging' : ''} ${dragOverId === cat.id ? 'drag-over' : ''}`}
                role="row"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.16) }}
                whileHover={{ y: -1 }}
                draggable
                onDragStart={() => setDraggingId(cat.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverId !== cat.id) setDragOverId(cat.id);
                }}
                onDrop={() => {
                  if (draggingId) handleRowReorder(draggingId, cat.id);
                  setDraggingId(null);
                  setDragOverId(null);
                }}
                onDragEnd={() => {
                  setDraggingId(null);
                  setDragOverId(null);
                }}
              >
                <div role="cell"><input type="checkbox" aria-label={`Chọn ${cat.name}`} checked={selected.has(cat.id)} onChange={e => toggleOne(cat.id, e.target.checked)} /></div>
                <div role="cell">
                  <div className="cat-thumb">
                    <img src={cat.image} alt={cat.name} />
                  </div>
                </div>
                <div role="cell" className="admin-bold">{cat.name}</div>
                <div role="cell"><span className="badge gray">{parentNameById.get(cat.parentId) || 'Không có'}</span></div>
                <div role="cell"><span className="badge blue">{cat.count} SP</span></div>
                <div role="cell" className="order-cell">
                  <GripVertical size={14} className="order-grip" />
                  <input
                    type="number"
                    min={0}
                    value={cat.order}
                    onChange={e => {
                      const nextOrder = Math.max(0, parseInt(e.target.value || '0', 10));
                      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, order: nextOrder } : c));
                    }}
                  />
                </div>
                <div role="cell"><span className={`admin-pill ${cat.status === 'visible' ? 'success' : 'neutral'}`}>{cat.status === 'visible' ? 'Đang hiện' : 'Ẩn'}</span></div>
                <div role="cell" className="admin-actions">
                  <button className="admin-icon-btn subtle" title={ADMIN_ACTION_TITLES.edit} aria-label={ADMIN_ACTION_TITLES.edit} onClick={() => openEditCategory(cat.id)}><Pencil size={16} /></button>
                  <button
                    className="admin-icon-btn subtle"
                    title={cat.status === 'visible' ? 'Ẩn danh mục' : 'Hiện danh mục'}
                    aria-label={cat.status === 'visible' ? 'Ẩn danh mục' : 'Hiện danh mục'}
                    onClick={() => {
                      void applyOptimisticCategoryUpdate(
                        prev => prev.map((c) => {
                          if (c.id !== cat.id) return c;
                          if (c.status === 'visible') return { ...c, status: 'hidden', showOnMenu: false };
                          return { ...c, status: 'visible' };
                        }),
                        'Đã cập nhật trạng thái danh mục',
                      );
                    }}
                  ><Layers size={16} /></button>
                  <button
                    className="admin-icon-btn subtle danger-icon"
                    title={ADMIN_ACTION_TITLES.delete}
                    aria-label={ADMIN_ACTION_TITLES.delete}
                    onClick={() => {
                      const blockReason = getCategoryDeleteBlockReason(cat);
                      if (blockReason) {
                        pushToast(blockReason);
                        return;
                      }
                      setDeleteConfirm({
                        ids: [cat.id],
                        selectedNoun: t.selectedNoun,
                        title: 'Xóa danh mục',
                        description: 'Bạn có chắc chắn muốn xóa danh mục này? Hành động này không thể hoàn tác.',
                        confirmLabel: 'Xóa danh mục',
                        undoMessage: `Đã xóa danh mục ${cat.name}`,
                      });
                    }}
                  ><Trash2 size={16} /></button>
                </div>
              </motion.div>
            ))}
          </div>
          )}

          {!isLoading && visibleCategories.length > 0 && (
            <div className="table-footer">
              <span className="table-footer-meta">{c.showing(startIndex, endIndex, visibleCategories.length, t.selectedNoun)}</span>
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
        {undoPayload && (
          <motion.div
            className="admin-undo-bar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
          >
            <span>{undoPayload.message}</span>
            <div className="admin-actions">
              <button className="admin-ghost-btn" onClick={restoreDeleted}>Hoàn tác</button>
              <button className="admin-icon-btn subtle" onClick={() => setUndoPayload(null)} aria-label={`${ADMIN_ACTION_TITLES.close} thông báo`}><X size={14} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                <button className="admin-ghost-btn danger" onClick={requestBulkDelete}>{t.floatingActions.deleteSelected}</button>
                <button className="admin-ghost-btn" onClick={bulkToggleStatus}>{t.floatingActions.changeStatus}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AdminConfirmDialog
        open={Boolean(deleteConfirm)}
        title={deleteConfirm?.title || 'Xác nhận xóa'}
        description={deleteConfirm?.description || ''}
        selectedItems={deleteConfirm?.selectedItems}
        selectedNoun={deleteConfirm?.selectedNoun}
        confirmLabel={deleteConfirm?.confirmLabel || 'Xóa'}
        danger
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={confirmDeleteCategories}
      />

      {showCategoryDrawer && (
        <>
          <div className="drawer-overlay" onClick={() => setShowCategoryDrawer(false)} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <p className="drawer-eyebrow">{categoryForm.id ? 'Chỉnh sửa' : 'Thêm'} danh mục</p>
                <h3>{categoryForm.name || 'Danh mục mới'}</h3>
              </div>
              <button className="admin-icon-btn" onClick={() => setShowCategoryDrawer(false)} aria-label={ADMIN_ACTION_TITLES.close}><X size={16} /></button>
            </div>

            <div className="drawer-body">
              <section className="drawer-section">
                <h4>Banner danh mục</h4>
                <div className="media-grid">
                  <div className="media-cover" style={{ backgroundImage: categoryForm.image ? `url(${categoryForm.image})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                    {!categoryForm.image && 'Tải banner'}
                  </div>
                  <button className="media-add" onClick={() => setCategoryForm(prev => ({ ...prev, image: 'https://images.unsplash.com/photo-1495107334309-fcf20504a5ab?auto=format&fit=crop&w=600&q=80' }))}>+ Chọn ảnh mẫu</button>
                </div>
              </section>

              <section className="drawer-section">
                <h4>Thông tin danh mục</h4>
                <div className="form-grid">
                  <label className="form-field">
                    <span>Tên danh mục</span>
                    <input
                      value={categoryForm.name}
                      onChange={e => {
                        const value = e.target.value;
                        setCategoryForm(prev => ({ ...prev, name: value, slug: prev.slug ? prev.slug : value ? toSlug(value) : '' }));
                        if (formErrors.name) setFormErrors(prev => ({ ...prev, name: undefined }));
                      }}
                    />
                    {formErrors.name && <small className="form-field-error">{formErrors.name}</small>}
                  </label>
                  <label className="form-field">
                    <span>Slug</span>
                    <input value={categoryForm.slug} onChange={e => handleCatSlugChange(e.target.value)} />
                    {formErrors.slug && <small className="form-field-error">{formErrors.slug}</small>}
                  </label>
                  <label className="form-field">
                    <span>Danh mục cha</span>
                    <select value={categoryForm.parentId} onChange={e => setCategoryForm(prev => ({ ...prev, parentId: e.target.value }))}>
                      <option value="">Không có</option>
                      {categories.filter(c => !blockedParentIds.has(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {formErrors.parent && <small className="form-field-error">{formErrors.parent}</small>}
                  </label>
                  <label className="form-field">
                    <span>Thứ tự hiển thị</span>
                    <input type="number" min={0} value={categoryForm.order} onChange={e => setCategoryForm(prev => ({ ...prev, order: Math.max(0, parseInt(e.target.value || '0', 10)) }))} />
                    {formErrors.order && <small className="form-field-error">{formErrors.order}</small>}
                  </label>
                  <label className="form-field full">
                    <span>Mô tả ngắn</span>
                    <textarea rows={3} value={categoryForm.description || ''} onChange={e => setCategoryForm(prev => ({ ...prev, description: e.target.value }))} />
                  </label>
                </div>
              </section>

              <section className="drawer-section">
                <h4>Hiển thị</h4>
                <div className="switch-row">
                  <div>
                    <p className="admin-bold">Hiển thị trên Menu chính</p>
                    <p className="admin-muted small">Bật để ghim danh mục vào menu</p>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={categoryForm.showOnMenu}
                      onChange={e => setCategoryForm(prev => ({ ...prev, showOnMenu: e.target.checked }))}
                    />
                    <span className="switch-slider" />
                  </label>
                </div>
              </section>
            </div>

            <div className="drawer-footer">
              <button className="admin-ghost-btn" onClick={() => setShowCategoryDrawer(false)}>Hủy</button>
              <button className="admin-primary-btn" onClick={handleSaveCategory}>Lưu danh mục</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast success">{toast}</div>}
    </AdminLayout>
  );
};

export default AdminCategories;
