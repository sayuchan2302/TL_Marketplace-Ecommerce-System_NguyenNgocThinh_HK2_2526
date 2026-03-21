import './Admin.css';
import { Filter, Search, Plus, Pencil, Layers, Trash2, ArrowUpDown, X, Link2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AdminVariantModal from './AdminVariantModal';
import type { VariantRow } from './AdminVariantModal';
import { AdminStateBlock, AdminTableSkeleton } from './AdminStateBlocks';
import AdminReasonDialog from './AdminReasonDialog';
import { useAdminListState } from './useAdminListState';
import { ADMIN_VIEW_KEYS } from './adminListView';
import { useAdminViewState } from './useAdminViewState';
import { useAdminToast } from './useAdminToast';
import {
  adjustProductStock,
  applyVariantMatrix,
  getProductInventoryLedger,
  getProductBySku,
  getProductVariantMatrix,
  listAdminProducts,
  subscribeAdminProducts,
  updateProductPrice,
  type AdminProductRecord,
} from './adminProductService';
import { ADMIN_ACTION_TITLES, ADMIN_COMMON_LABELS } from './adminUiLabels';
import { productStatusTone } from './adminStatusMaps';
import { ADMIN_TOAST_MESSAGES } from './adminMessages';
import { ADMIN_TEXT } from './adminText';

const MANAGED_PRODUCT_SKU = 'POLO-001';

interface PendingStockAdjustment {
  sku: string;
  before: number;
  after: number;
  suggestedReason: string;
}

const tabs = [
  { key: 'all', label: ADMIN_TEXT.products.tabs.all },
  { key: 'stock-alert', label: ADMIN_TEXT.products.tabs.stockAlert },
  { key: 'active', label: ADMIN_TEXT.products.tabs.active },
  { key: 'low', label: ADMIN_TEXT.products.tabs.low },
  { key: 'out', label: ADMIN_TEXT.products.tabs.out },
];

const validProductTabs = new Set(tabs.map((tab) => tab.key));

const AdminProducts = () => {
  const t = ADMIN_TEXT.products;
  const c = ADMIN_TEXT.common;
  const view = useAdminViewState({
    storageKey: ADMIN_VIEW_KEYS.products,
    path: '/admin/products',
    validStatusKeys: tabs.map((tab) => tab.key),
    defaultStatus: 'all',
    statusAliases: ['view'],
    validSortKeys: ['price', 'stock'],
  });
  const activeTab = validProductTabs.has(view.status) ? view.status : 'all';
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<AdminProductRecord[]>(() => listAdminProducts());
  const [editingPrice, setEditingPrice] = useState<{ sku: string; value: string } | null>(null);
  const [editingStock, setEditingStock] = useState<{ sku: string; value: string } | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const { toast, pushToast } = useAdminToast(1800);
  const [showVariants, setShowVariants] = useState(false);
  const [pendingStockAdjustment, setPendingStockAdjustment] = useState<PendingStockAdjustment | null>(null);
  const [variantRows, setVariantRows] = useState<VariantRow[]>(() => getProductVariantMatrix(MANAGED_PRODUCT_SKU));
  const [inventoryLogs, setInventoryLogs] = useState(() => getProductInventoryLedger(MANAGED_PRODUCT_SKU, 6));
  const [price, setPrice] = useState('359.000');
  const [salePrice, setSalePrice] = useState('329.000');
  const [stock, setStock] = useState(() => {
    const managed = listAdminProducts().find((item) => item.sku === MANAGED_PRODUCT_SKU);
    return String(managed?.stock || 0);
  });
  const [slug, setSlug] = useState('ao-polo-cotton-khu-mui');
  const [metaTitle, setMetaTitle] = useState('Áo Polo Cotton Khử Mùi - Coolmate');
  const {
    search,
    isLoading,
    filteredItems: filtered,
    pagedItems: pagedProducts,
    page,
    totalPages,
    startIndex,
    endIndex,
    next,
    prev,
    setPage,
    toggleSort,
  } = useAdminListState<typeof rows[number]>({
    items: rows,
    pageSize: 8,
    searchValue: view.search,
    onSearchChange: view.setSearch,
    pageValue: view.page,
    onPageChange: view.setPage,
    sortKeyValue: view.sortKey,
    sortDirectionValue: view.sortDirection,
    onSortChange: view.setSort,
    getSearchText: (p) => `${p.name} ${p.sku} ${p.category}`,
    filterPredicate: (p) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'stock-alert') return p.stock < 10;
      return p.statusType === activeTab;
    },
    sorters: {
      price: (a, b) => a.price - b.price,
      stock: (a, b) => a.stock - b.stock,
    },
    loadingDeps: [activeTab],
  });

  const hasVariants = variantRows.length > 0;
  const variantStockTotal = useMemo(() => variantRows.reduce((sum, r) => sum + (parseInt(r.stock.replace(/\D/g, ''), 10) || 0), 0), [variantRows]);

  useEffect(() => {
    const syncProducts = () => {
      const latest = listAdminProducts();
      setRows(latest);
      const managed = latest.find((item) => item.sku === MANAGED_PRODUCT_SKU);
      if (managed) {
        setVariantRows(managed.variantMatrix);
        setStock(String(managed.stock));
      }
      setInventoryLogs(getProductInventoryLedger(MANAGED_PRODUCT_SKU, 6));
    };

    const unsubscribe = subscribeAdminProducts(syncProducts);
    syncProducts();
    return unsubscribe;
  }, []);

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
    view.resetCurrentView();
    pushToast(ADMIN_TOAST_MESSAGES.products.resetView);
  };

  const activeTabLabel = tabs.find((tab) => tab.key === activeTab)?.label || t.tabs.all;
  const hasViewContext = activeTab !== 'all' || Boolean(search.trim()) || view.page > 1 || Boolean(view.sortKey);

  const changeTab = (nextTab: string) => {
    setSelected(new Set());
    view.setStatus(nextTab);
  };

  const tabCounts = {
    all: rows.length,
    'stock-alert': rows.filter((p) => p.stock < 10).length,
    active: rows.filter((p) => p.statusType === 'active').length,
    low: rows.filter((p) => p.statusType === 'low').length,
    out: rows.filter((p) => p.statusType === 'out').length,
  } as const;

  const formatCurrency = (val: string) => {
    const digits = val.replace(/\D/g, '');
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleSlugChange = (val: string) => {
    const clean = val
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    setSlug(clean);
  };

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map(p => p.sku)));
    else setSelected(new Set());
  };

  const toggleOne = (sku: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(sku); else next.delete(sku);
    setSelected(next);
  };

  const savePrice = () => {
    if (!editingPrice) return;
    const value = parseInt(editingPrice.value.replace(/\D/g, ''), 10) || 0;
    const result = updateProductPrice(editingPrice.sku, value);
    if (!result.ok) {
      pushToast(result.error);
    } else {
      pushToast(ADMIN_TOAST_MESSAGES.products.priceUpdated(editingPrice.sku));
    }
    setEditingPrice(null);
  };

  const saveStock = () => {
    if (!editingStock) return;
    const value = parseInt(editingStock.value.replace(/\D/g, ''), 10) || 0;
    const current = rows.find((item) => item.sku === editingStock.sku);
    if (!current) {
      pushToast(ADMIN_TOAST_MESSAGES.products.stockTargetMissing);
      setEditingStock(null);
      return;
    }

    if (value === current.stock) {
      setEditingStock(null);
      return;
    }

    setEditingStock(null);
    setPendingStockAdjustment({
      sku: editingStock.sku,
      before: current.stock,
      after: value,
      suggestedReason: value > current.stock ? 'Nhập kho bổ sung' : 'Điều chỉnh hao hụt tồn kho',
    });
  };

  const confirmStockAdjustment = (reason: string) => {
    if (!pendingStockAdjustment) return;
    const result = adjustProductStock({
      sku: pendingStockAdjustment.sku,
      nextStock: pendingStockAdjustment.after,
      actor: 'Admin',
      reason,
      source: 'manual_adjustment',
    });
    if (!result.ok) {
      pushToast(result.error);
      return;
    }
    pushToast(
      ADMIN_TOAST_MESSAGES.products.stockAdjusted(
        pendingStockAdjustment.sku,
        pendingStockAdjustment.before,
        pendingStockAdjustment.after,
      ),
    );
    setPendingStockAdjustment(null);
  };

  const openDrawer = () => {
    const managed = getProductBySku(MANAGED_PRODUCT_SKU);
    if (managed) {
      setVariantRows(managed.variantMatrix);
      setStock(String(managed.stock));
      setInventoryLogs(getProductInventoryLedger(MANAGED_PRODUCT_SKU, 6));
    }
    setShowDrawer(true);
  };
  const closeDrawer = () => setShowDrawer(false);

  const handleSaveDrawer = () => {
    pushToast(ADMIN_TOAST_MESSAGES.products.saved, 2000);
    setShowDrawer(false);
  };

  const openVariants = () => setShowVariants(true);
  const closeVariants = () => setShowVariants(false);

  const handleVariantsSaved = (matrix: VariantRow[]) => {
    const result = applyVariantMatrix({
      sku: MANAGED_PRODUCT_SKU,
      matrix,
      actor: 'Admin',
    });
    if (!result.ok) {
      pushToast(result.error, 2200);
      return;
    }
    setVariantRows(matrix);
    setInventoryLogs(getProductInventoryLedger(MANAGED_PRODUCT_SKU, 6));
    pushToast(ADMIN_TOAST_MESSAGES.products.variantsSynced, 2000);
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
          <button className="admin-ghost-btn" onClick={() => pushToast(ADMIN_TOAST_MESSAGES.advancedFilterComingSoon)}><Filter size={16} /> {c.filter}</button>
          <button className="admin-ghost-btn" onClick={shareCurrentView}><Link2 size={16} /> {ADMIN_COMMON_LABELS.shareView}</button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>{ADMIN_COMMON_LABELS.resetView}</button>
          <button type="button" className="admin-primary-btn" onClick={openDrawer}><Plus size={16} /> {t.addProduct}</button>
        </>
      )}
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
          {isLoading ? (
            <AdminTableSkeleton columns={7} rows={6} />
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
            <div className="admin-table-row admin-table-head products" role="row">
              <div role="columnheader"><input type="checkbox" aria-label="Chọn tất cả" checked={selected.size === filtered.length && filtered.length > 0} onChange={e => toggleAll(e.target.checked)} /></div>
              <div role="columnheader">{t.columns.product}</div>
              <div role="columnheader">{t.columns.category}</div>
              <div role="columnheader" className="sortable">
                <button className="sort-trigger" onClick={() => toggleSort('price')}>{t.columns.price} <ArrowUpDown size={14} /></button>
              </div>
              <div role="columnheader" className="sortable">
                <button className="sort-trigger" onClick={() => toggleSort('stock')}>{t.columns.stock} <ArrowUpDown size={14} /></button>
              </div>
              <div role="columnheader">{t.columns.status}</div>
              <div role="columnheader">{t.columns.actions}</div>
            </div>
            {pagedProducts.map((p, idx) => (
              <motion.div
                className="admin-table-row products"
                role="row"
                key={p.sku}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(idx * 0.025, 0.16) }}
                whileHover={{ y: -1 }}
              >
                <div role="cell"><input type="checkbox" aria-label={`Chọn ${p.sku}`} checked={selected.has(p.sku)} onChange={e => toggleOne(p.sku, e.target.checked)} /></div>
                <div role="cell" className="product-cell">
                  <span className="thumb-wrapper">
                    <img src={p.thumb} alt={p.name} className="product-thumb" />
                    <img src={p.thumb} alt={p.name} className="thumb-preview" />
                  </span>
                  <div>
                    <p className="admin-bold">{p.name}</p>
                    <p className="admin-muted">{p.variants}</p>
                    <p className="admin-muted small">SKU: {p.sku}</p>
                  </div>
                </div>
                <div role="cell"><span className="badge">{p.category}</span></div>
                <div role="cell" className="price-cell">
                  {editingPrice?.sku === p.sku ? (
                    <input
                      className="inline-input"
                      value={editingPrice.value}
                      onChange={e => setEditingPrice({ sku: p.sku, value: e.target.value })}
                      onBlur={savePrice}
                      onKeyDown={e => e.key === 'Enter' && savePrice()}
                      autoFocus
                    />
                  ) : (
                    <button className="inline-edit" onClick={() => setEditingPrice({ sku: p.sku, value: p.price.toString() })}>
                      {p.price.toLocaleString('vi-VN')} đ
                      <Pencil size={14} className="inline-icon" />
                    </button>
                  )}
                </div>
                <div role="cell" className={`stock-cell ${p.stock < 10 ? 'low-stock' : ''}`}>
                  {editingStock?.sku === p.sku ? (
                    <input
                      className="inline-input"
                      value={editingStock.value}
                      onChange={e => setEditingStock({ sku: p.sku, value: e.target.value })}
                      onBlur={saveStock}
                      onKeyDown={e => e.key === 'Enter' && saveStock()}
                      autoFocus
                    />
                  ) : (
                    <button className="inline-edit" onClick={() => setEditingStock({ sku: p.sku, value: p.stock.toString() })}>
                      {p.stock}
                      <Pencil size={14} className="inline-icon" />
                    </button>
                  )}
                </div>
                <div role="cell"><span className={`admin-pill ${productStatusTone(p.statusType)}`}>{p.status}</span></div>
                <div role="cell" className="admin-actions">
                  <button className="admin-icon-btn subtle" title={ADMIN_ACTION_TITLES.edit} aria-label={ADMIN_ACTION_TITLES.edit} onClick={openDrawer}><Pencil size={16} /></button>
                  <button className="admin-icon-btn subtle" title={ADMIN_ACTION_TITLES.manageVariants} aria-label={ADMIN_ACTION_TITLES.manageVariants} onClick={openVariants}><Layers size={16} /></button>
                  <button className="admin-icon-btn subtle danger-icon" title={ADMIN_ACTION_TITLES.delete} aria-label={ADMIN_ACTION_TITLES.delete}><Trash2 size={16} /></button>
                </div>
              </motion.div>
            ))}
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
                <button className="admin-ghost-btn">{t.floatingActions.changeStatus}</button>
                <button className="admin-ghost-btn">{t.floatingActions.exportExcel}</button>
                <button className="admin-ghost-btn danger">{t.floatingActions.delete}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AdminReasonDialog
        open={Boolean(pendingStockAdjustment)}
        title="Xác nhận điều chỉnh tồn kho"
        description="Vui lòng nhập lý do trước khi cập nhật tồn kho sản phẩm."
        fieldLabel="Lý do điều chỉnh"
        placeholder="Ví dụ: Nhập kho bổ sung từ nhà cung cấp"
        defaultValue={pendingStockAdjustment?.suggestedReason || ''}
        selectedItems={
          pendingStockAdjustment
            ? [`${pendingStockAdjustment.sku}: ${pendingStockAdjustment.before} -> ${pendingStockAdjustment.after}`]
            : undefined
        }
        selectedNoun="sản phẩm"
        confirmLabel="Xác nhận cập nhật"
        onCancel={() => setPendingStockAdjustment(null)}
        onConfirm={confirmStockAdjustment}
      />

      {showDrawer && (
        <>
          <div className="drawer-overlay" onClick={closeDrawer} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <p className="drawer-eyebrow">Chỉnh sửa sản phẩm</p>
                <h3>#POLO-001</h3>
              </div>
              <button className="admin-icon-btn" onClick={closeDrawer} aria-label={ADMIN_ACTION_TITLES.close}><X size={16} /></button>
            </div>

            <div className="drawer-body">
              <section className="drawer-section">
                <h4>Hình ảnh</h4>
                <div className="media-grid">
                  <div className="media-cover">Ảnh đại diện</div>
                  <div className="media-thumb">Ảnh phụ</div>
                  <div className="media-thumb">Ảnh phụ</div>
                  <button className="media-add">+ Thêm ảnh</button>
                </div>
              </section>

              <section className="drawer-section">
                <h4>Thông tin chung</h4>
                <div className="form-grid">
                  <label className="form-field">
                    <span>Tên sản phẩm</span>
                    <input type="text" defaultValue="Áo Polo Cotton Khử Mùi" />
                  </label>
                  <label className="form-field">
                    <span>SKU</span>
                    <input type="text" defaultValue="POLO-001" />
                  </label>
                  <label className="form-field">
                    <span>Danh mục</span>
                    <select defaultValue="polo">
                      <option value="polo">Áo Polo</option>
                      <option value="jeans">Quần Jeans</option>
                      <option value="tee">Áo Thun</option>
                    </select>
                  </label>
                </div>
                <label className="form-field">
                  <span>Mô tả sản phẩm</span>
                  <textarea rows={4} defaultValue="Mô tả ngắn gọn về chất liệu, form và công năng..." />
                </label>
              </section>

              <section className="drawer-section two-col">
                <div>
                  <h4>Giá & Khuyến mãi</h4>
                  <label className="form-field">
                    <span>Giá bán</span>
                    <input
                      type="text"
                      value={price}
                      onChange={e => setPrice(formatCurrency(e.target.value))}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="form-field">
                    <span>Giá khuyến mãi</span>
                    <input
                      type="text"
                      value={salePrice}
                      onChange={e => setSalePrice(formatCurrency(e.target.value))}
                      inputMode="numeric"
                    />
                  </label>
                </div>
                <div>
                  <h4>Tồn kho</h4>
                  <label className="form-field">
                    <span>Số lượng</span>
                    <input
                      type="text"
                      value={hasVariants ? formatCurrency(variantStockTotal.toString()) : stock}
                      onChange={e => setStock(formatCurrency(e.target.value))}
                      inputMode="numeric"
                      disabled={hasVariants}
                      className={hasVariants ? 'disabled-input' : ''}
                    />
                    {hasVariants && <span className="admin-muted small">Tự động tính từ biến thể</span>}
                  </label>
                </div>
              </section>

              <section className="drawer-section">
                <h4>Nhật ký tồn kho gần nhất</h4>
                {inventoryLogs.length === 0 ? (
                  <p className="admin-muted small">Chưa có biến động tồn kho.</p>
                ) : (
                  <ul className="inventory-log-list">
                    {inventoryLogs.map((entry) => (
                      <li key={entry.id}>
                        <div>
                          <p className="admin-bold">{entry.delta >= 0 ? `+${entry.delta}` : entry.delta} đơn vị · {entry.reason}</p>
                          <p className="admin-muted small">{new Date(entry.at).toLocaleString('vi-VN')} · {entry.actor} · {entry.source}</p>
                        </div>
                        <span className="admin-muted small">{entry.beforeStock} → {entry.afterStock}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="drawer-section">
                <h4>Thuộc tính</h4>
                <div className="form-grid">
                  <label className="form-field">
                    <span>Chất liệu</span>
                    <select defaultValue="cotton">
                      <option value="cotton">Cotton</option>
                      <option value="poly">Polyester</option>
                      <option value="blend">Blend</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Form dáng</span>
                    <select defaultValue="regular">
                      <option value="regular">Regular</option>
                      <option value="slim">Slim</option>
                      <option value="oversize">Oversize</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>Giới tính</span>
                    <select defaultValue="unisex">
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="unisex">Unisex</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="drawer-section">
                <h4>Tối ưu SEO</h4>
                <div className="form-grid">
                  <label className="form-field">
                    <span>URL Slug</span>
                    <input value={slug} onChange={e => handleSlugChange(e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>Meta Title</span>
                    <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} />
                  </label>
                </div>
              </section>
            </div>

            <div className="drawer-footer">
              <button className="admin-ghost-btn" onClick={closeDrawer}>Hủy</button>
              <button className="admin-primary-btn" onClick={handleSaveDrawer}>Lưu thay đổi</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast success">{toast}</div>}
      {showVariants && (
        <AdminVariantModal
          initialMatrix={variantRows}
          onClose={closeVariants}
          onSaved={handleVariantsSaved}
        />
      )}
    </AdminLayout>
  );
};

export default AdminProducts;
