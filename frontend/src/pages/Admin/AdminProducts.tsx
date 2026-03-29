import './Admin.css';
import { Filter, Search, Plus, Pencil, Layers, Trash2, ArrowUpDown, X, Link2 } from 'lucide-react';
import AdminLayout from './AdminLayout';
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import AdminVariantModal from './AdminVariantModal';
import type { VariantRow } from './AdminVariantModal';
import { AdminStateBlock } from './AdminStateBlocks';
import Portal from '../../components/Portal/Portal';
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
  listAdminProducts,
  subscribeAdminProducts,
  updateProductPrice,
  type AdminProductRecord,
  type InventoryMovement,
} from './adminProductService';
import { productStatusTone } from './adminStatusMaps';
import { ADMIN_DICTIONARY } from './adminDictionary';

const MANAGED_PRODUCT_SKU = 'POLO-001';

interface PendingStockAdjustment {
  sku: string;
  before: number;
  after: number;
  suggestedReason: string;
}

const tabs = [
  { key: 'all', label: ADMIN_DICTIONARY.products.tabs.all },
  { key: 'stock-alert', label: ADMIN_DICTIONARY.products.tabs.stockAlert },
  { key: 'active', label: ADMIN_DICTIONARY.products.tabs.active },
  { key: 'low', label: ADMIN_DICTIONARY.products.tabs.low },
  { key: 'out', label: ADMIN_DICTIONARY.products.tabs.out },
];

const validProductTabs = new Set(tabs.map((tab) => tab.key));

const AdminProducts = () => {
  const t = ADMIN_DICTIONARY.products;
  const c = ADMIN_DICTIONARY.common;
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
  const [rows, setRows] = useState<AdminProductRecord[]>([]);
  const [editingPrice, setEditingPrice] = useState<{ sku: string; value: string } | null>(null);
  const [editingStock, setEditingStock] = useState<{ sku: string; value: string } | null>(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const { toast, pushToast } = useAdminToast(1800);
  const [showVariants, setShowVariants] = useState(false);
  const [pendingStockAdjustment, setPendingStockAdjustment] = useState<PendingStockAdjustment | null>(null);
  const [variantRows, setVariantRows] = useState<VariantRow[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryMovement[]>([]);
  const [price, setPrice] = useState('359.000');
  const [salePrice, setSalePrice] = useState('329.000');
  const [stock, setStock] = useState('0');
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
    let mounted = true;
    const syncProducts = async () => {
      const latest = await listAdminProducts();
      if (!mounted) return;
      setRows(latest);
      const managed = latest.find((item) => item.sku === MANAGED_PRODUCT_SKU);
      if (managed) {
        setVariantRows(managed.variantMatrix || []);
        setStock(String(managed.stock || 0));
      }
      const logs = await getProductInventoryLedger(MANAGED_PRODUCT_SKU, 6);
      if (mounted) setInventoryLogs(logs || []);
    };

    const unsubscribe = subscribeAdminProducts(syncProducts);
    syncProducts();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const handleSearchChange = (value: string) => {
    view.setSearch(value);
  };

  const shareCurrentView = async () => {
    try {
      await view.shareCurrentView();
       pushToast(ADMIN_DICTIONARY.actions.shareView);
    } catch {
       pushToast(ADMIN_DICTIONARY.messages.copyFailed);
    }
  };

  const resetCurrentView = () => {
    setSelected(new Set());
    view.resetCurrentView();
     pushToast(ADMIN_DICTIONARY.messages.products.resetView);
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

  const savePrice = async () => {
    if (!editingPrice) return;
    const value = parseInt(editingPrice.value.replace(/\D/g, ''), 10) || 0;
    const result = await updateProductPrice(editingPrice.sku, value);
    if (!result.ok) {
      pushToast(result.error || 'Lỗi lưu giá');
    } else {
       pushToast(ADMIN_DICTIONARY.messages.products.priceUpdated(editingPrice.sku));
    }
    setEditingPrice(null);
  };

  const saveStock = () => {
    if (!editingStock) return;
    const value = parseInt(editingStock.value.replace(/\D/g, ''), 10) || 0;
    const current = rows.find((item) => item.sku === editingStock.sku);
    if (!current) {
      pushToast(ADMIN_DICTIONARY.messages.products.stockTargetMissing);
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

  const confirmStockAdjustment = async (reason: string) => {
    if (!pendingStockAdjustment) return;
    const result = await adjustProductStock({
      sku: pendingStockAdjustment.sku,
      nextStock: pendingStockAdjustment.after,
      actor: 'Admin',
      reason,
      source: 'manual_adjustment',
    });
    if (!result.ok) {
      pushToast(result.error || 'Lỗi lưu kho');
      return;
    }
    pushToast(
      ADMIN_DICTIONARY.messages.products.stockAdjusted(
        pendingStockAdjustment.sku,
        pendingStockAdjustment.before,
        pendingStockAdjustment.after,
      ),
    );
    setPendingStockAdjustment(null);
  };

  const openDrawer = async (product?: AdminProductRecord) => {
    const sku = product?.sku || MANAGED_PRODUCT_SKU;
    const managed = await getProductBySku(sku);
    if (managed) {
      setVariantRows(managed.variantMatrix);
      setStock(String(managed.stock));
      const logs = await getProductInventoryLedger(sku, 6);
      setInventoryLogs(logs);
    }
    setShowDrawer(true);
  };

  const handleAddProduct = () => {
    void openDrawer();
  };
  const closeDrawer = () => setShowDrawer(false);

  const handleSaveDrawer = () => {
    pushToast(ADMIN_DICTIONARY.messages.products.saved, 2000);
    setShowDrawer(false);
  };

  const openVariants = () => setShowVariants(true);
  const closeVariants = () => setShowVariants(false);

  const handleVariantsSaved = async (matrix: VariantRow[]) => {
    const result = await applyVariantMatrix(MANAGED_PRODUCT_SKU, matrix);
    if (!result.ok) {
      pushToast(result.error || 'Không thể đồng bộ biến thể', 2200);
      return;
    }
    setVariantRows(matrix);
    const logs = await getProductInventoryLedger(MANAGED_PRODUCT_SKU, 6);
    setInventoryLogs(logs);
    pushToast(ADMIN_DICTIONARY.messages.products.variantsSynced, 2000);
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
          <button className="admin-ghost-btn" onClick={() => pushToast(ADMIN_DICTIONARY.messages.advancedFilterComingSoon)}><Filter size={16} /> {c.filter}</button>
          <button className="admin-ghost-btn" onClick={shareCurrentView}><Link2 size={16} /> {ADMIN_DICTIONARY.actions.shareView}</button>
          <button className="admin-ghost-btn" onClick={resetCurrentView}>{ADMIN_DICTIONARY.actions.resetView}</button>
          <button type="button" className="admin-primary-btn" onClick={handleAddProduct}><Plus size={16} /> {t.addProduct}</button>
        </>
      )}
    >
      {/* ── Stat Cards ─────────────────────────────────────── */}
      <div className="admin-stats grid-4">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Tổng sản phẩm</div>
          <div className="admin-stat-value">{tabCounts.all}</div>
          <div className="admin-stat-sub">Đang quản lý</div>
        </div>
        <div className="admin-stat-card success"
          onClick={() => changeTab('active')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-label">Đang bán</div>
          <div className="admin-stat-value">{tabCounts.active}</div>
          <div className="admin-stat-sub">Sản phẩm tốt</div>
        </div>
        <div className={`admin-stat-card ${tabCounts['stock-alert'] > 0 ? 'warning' : ''}`}
          onClick={() => changeTab('stock-alert')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-label">Cảnh báo kho</div>
          <div className="admin-stat-value">{tabCounts['stock-alert']}</div>
          <div className="admin-stat-sub">Tồn kho &lt; 10</div>
        </div>
        <div className={`admin-stat-card ${tabCounts.out > 0 ? 'danger' : ''}`}
          onClick={() => changeTab('out')} style={{ cursor: 'pointer' }}>
          <div className="admin-stat-label">Hết hàng</div>
          <div className="admin-stat-value">{tabCounts.out}</div>
          <div className="admin-stat-sub">Cần nhập thêm</div>
        </div>
      </div>

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
          {isLoading ? null : filtered.length === 0 ? (
            <AdminStateBlock
              type={search.trim() ? 'search-empty' : 'empty'}
              title={search.trim() ? t.empty.searchTitle : t.empty.defaultTitle}
              description={search.trim() ? t.empty.searchDescription : t.empty.defaultDescription}
              actionLabel={ADMIN_DICTIONARY.actions.resetFilters}
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
                onClick={() => openDrawer(p)}
                style={{ cursor: 'pointer' }}
              >
                <div role="cell" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Chọn ${p.sku}`} checked={selected.has(p.sku)} onChange={e => toggleOne(p.sku, e.target.checked)} /></div>
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
                <div role="cell" className="price-cell" onClick={(e) => e.stopPropagation()}>
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
                      {p.price.toLocaleString('vi-VN')} ₫
                      <Pencil size={14} className="inline-icon" />
                    </button>
                  )}
                </div>
                <div role="cell" className={`stock-cell ${p.stock < 10 ? 'low-stock' : ''}`} onClick={(e) => e.stopPropagation()}>
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
                <div role="cell" className="admin-actions" onClick={(e) => e.stopPropagation()}>
                  <button className="admin-icon-btn subtle" title={ADMIN_DICTIONARY.actionTitles.edit} aria-label={ADMIN_DICTIONARY.actionTitles.edit} onClick={() => openDrawer(p)}><Pencil size={16} /></button>
                  <button className="admin-icon-btn subtle" title={ADMIN_DICTIONARY.actionTitles.manageVariants} aria-label={ADMIN_DICTIONARY.actionTitles.manageVariants} onClick={openVariants}><Layers size={16} /></button>
                  <button className="admin-icon-btn subtle danger-icon" title={ADMIN_DICTIONARY.actionTitles.delete} aria-label={ADMIN_DICTIONARY.actionTitles.delete}><Trash2 size={16} /></button>
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
        <Portal>
          <div className="drawer-overlay" onClick={closeDrawer} />
          <div className="drawer">
            <div className="drawer-header">
              <div>
                <p className="drawer-eyebrow">{t.drawer.title}</p>
                <h3>#POLO-001</h3>
              </div>
               <button className="admin-icon-btn" onClick={closeDrawer} aria-label={ADMIN_DICTIONARY.actionTitles.close}><X size={16} /></button>
            </div>

            <div className="drawer-body">
              <section className="drawer-section">
                <h4>{t.drawer.images}</h4>
                <div className="media-grid">
                  <div className="media-cover">{t.drawer.coverImage}</div>
                  <div className="media-thumb">{t.drawer.thumbnail}</div>
                  <div className="media-thumb">{t.drawer.thumbnail}</div>
                  <button className="media-add">+ {t.drawer.addImage}</button>
                </div>
              </section>

              <section className="drawer-section">
                <h4>{t.drawer.generalInfo}</h4>
                <div className="form-grid">
                  <label className="form-field">
                    <span>{t.drawer.name}</span>
                    <input type="text" defaultValue="Áo Polo Cotton Khử Mùi" />
                  </label>
                  <label className="form-field">
                    <span>{t.drawer.sku}</span>
                    <input type="text" defaultValue="POLO-001" />
                  </label>
                  <label className="form-field">
                    <span>{t.drawer.category}</span>
                    <select defaultValue="polo">
                      <option value="polo">Áo Polo</option>
                      <option value="jeans">Quần Jeans</option>
                      <option value="tee">Áo Thun</option>
                    </select>
                  </label>
                </div>
                <label className="form-field">
                  <span>{t.drawer.description}</span>
                  <textarea rows={4} defaultValue={t.drawer.descriptionPlaceholder} />
                </label>
              </section>

              <section className="drawer-section two-col">
                <div>
                  <h4>{t.drawer.pricingInventory}</h4>
                  <label className="form-field">
                    <span>{t.drawer.price}</span>
                    <input
                      type="text"
                      value={price}
                      onChange={e => setPrice(formatCurrency(e.target.value))}
                      inputMode="numeric"
                    />
                  </label>
                  <label className="form-field">
                    <span>{t.drawer.salePrice}</span>
                    <input
                      type="text"
                      value={salePrice}
                      onChange={e => setSalePrice(formatCurrency(e.target.value))}
                      inputMode="numeric"
                    />
                  </label>
                </div>
                <div>
                  <h4>{t.drawer.inventory}</h4>
                  <label className="form-field">
                    <span>{t.drawer.quantity}</span>
                    <input
                      type="text"
                      value={hasVariants ? formatCurrency(variantStockTotal.toString()) : stock}
                      onChange={e => setStock(formatCurrency(e.target.value))}
                      inputMode="numeric"
                      disabled={hasVariants}
                      className={hasVariants ? 'disabled-input' : ''}
                    />
                    {hasVariants && <span className="admin-muted small">{t.drawer.autoCalculated}</span>}
                  </label>
                </div>
              </section>

              <section className="drawer-section">
                <h4>{t.drawer.inventoryLog}</h4>
                {inventoryLogs.length === 0 ? (
                  <p className="admin-muted small">{t.drawer.noInventoryChanges}</p>
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
                <h4>{t.drawer.attributes}</h4>
                <div className="form-grid">
                  <label className="form-field">
                    <span>{t.drawer.material}</span>
                    <select defaultValue="cotton">
                      <option value="cotton">Cotton</option>
                      <option value="poly">Polyester</option>
                      <option value="blend">Blend</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{t.drawer.fit}</span>
                    <select defaultValue="regular">
                      <option value="regular">Regular</option>
                      <option value="slim">Slim</option>
                      <option value="oversize">Oversize</option>
                    </select>
                  </label>
                  <label className="form-field">
                    <span>{t.drawer.gender}</span>
                    <select defaultValue="unisex">
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="unisex">Unisex</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="drawer-section">
                <h4>{t.drawer.seo}</h4>
                <div className="form-grid">
                  <label className="form-field">
                    <span>{t.drawer.slug}</span>
                    <input value={slug} onChange={e => handleSlugChange(e.target.value)} />
                  </label>
                  <label className="form-field">
                    <span>{t.drawer.metaTitle}</span>
                    <input value={metaTitle} onChange={e => setMetaTitle(e.target.value)} />
                  </label>
                </div>
              </section>
            </div>

            <div className="drawer-footer">
              <button className="admin-ghost-btn" onClick={closeDrawer}>{c.cancel}</button>
              <button className="admin-primary-btn" onClick={handleSaveDrawer}>{c.save}</button>
            </div>
          </div>
        </Portal>
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
