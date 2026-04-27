import './Vendor.css';
import './VendorProducts.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import VendorLayout from './VendorLayout';
import { useToast } from '../../contexts/ToastContext';
import { PanelTabs } from '../../components/Panel/PanelPrimitives';
import { AdminToast } from '../Admin/AdminStateBlocks';
import { PRODUCT_TABS, PAGE_SIZE } from './vendorProducts.constants';
import { useVendorProductsQueryState } from './useVendorProductsQueryState';
import { useVendorProductsSelection } from './useVendorProductsSelection';
import { useVendorProductsData } from './useVendorProductsData';
import { useVendorProductBulkActions } from './useVendorProductBulkActions';
import { useVendorProductEditor } from './useVendorProductEditor';
import VendorProductsStats from './components/products/VendorProductsStats';
import VendorProductsTable from './components/products/VendorProductsTable';
import VendorProductDrawer from './components/products/VendorProductDrawer';
import VendorProductsDeleteDialog from './components/products/VendorProductsDeleteDialog';

const VendorProducts = () => {
  const { addToast } = useToast();
  const [showDrawer, setShowDrawer] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimerRef = useRef<number | null>(null);

  const selection = useVendorProductsSelection();
  const {
    activeTab,
    page,
    keyword,
    updateQuery,
    handleTabChange,
    setPage,
    resetCurrentView,
  } = useVendorProductsQueryState({
    onScopeChange: selection.clearSelection,
  });

  const {
    products,
    loading,
    loadError,
    totalElements,
    totalPages,
    statusCounts,
    loadProducts,
    removeProductsOptimistically,
  } = useVendorProductsData({
    activeTab,
    keyword,
    page,
    updateQuery,
    pruneToVisibleIds: selection.pruneToVisibleIds,
    addToast,
  });

  const pushToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToast('');
      toastTimerRef.current = null;
    }, 2600);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const bulkActions = useVendorProductBulkActions({
    products,
    clearSelection: selection.clearSelection,
    loadProducts,
    removeProductsOptimistically,
    addToast,
    pushToast,
  });

  const editor = useVendorProductEditor({
    products,
    showDrawer,
    setShowDrawer,
    addToast,
    pushToast,
    loadProducts,
  });

  const startIndex = products.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, totalElements);
  const productIds = useMemo(() => products.map((product) => product.id), [products]);
  const allSelected = productIds.length > 0 && selection.selected.size === productIds.length;

  const tabItems = PRODUCT_TABS.map((tab) => ({
    key: tab.key,
    label: tab.label,
    count: tab.key === 'all'
      ? statusCounts.all
      : tab.key === 'active'
        ? statusCounts.active
        : tab.key === 'outOfStock'
          ? statusCounts.outOfStock
          : statusCounts.draft,
  }));

  return (
    <VendorLayout
      title="Sản phẩm và tồn kho"
      breadcrumbs={['Kênh Người Bán', 'Sản phẩm']}
      actions={(
        <button className="vendor-primary-btn" onClick={editor.openCreateDrawer} disabled={bulkActions.working}>
          <Plus size={16} style={{ marginRight: 6 }} />
          Thêm sản phẩm
        </button>
      )}
    >
      <VendorProductsStats statusCounts={statusCounts} onTabChange={handleTabChange} />

      <PanelTabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} accentClassName="vendor-active-tab" />

      <section className="admin-panels single">
        <div className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Danh sách sản phẩm</h2>
            </div>
          </div>

          <VendorProductsTable
            loading={loading}
            loadError={loadError}
            keyword={keyword}
            products={products}
            allSelected={allSelected}
            working={bulkActions.working}
            startIndex={startIndex}
            endIndex={endIndex}
            totalElements={totalElements}
            page={page}
            totalPages={totalPages}
            onReload={() => void loadProducts()}
            onResetCurrentView={resetCurrentView}
            onOpenCreateProductDrawer={editor.openCreateDrawer}
            onToggleSelectAll={(checked) => selection.toggleSelectAll(checked, productIds)}
            isSelected={(id) => selection.selected.has(id)}
            onToggleOne={selection.toggleOne}
            onOpenEditDrawer={editor.openEditDrawer}
            onToggleVisibility={(id, visible) => void bulkActions.applyVisibility([id], visible)}
            onRequestDelete={bulkActions.requestDelete}
            onPageChange={setPage}
          />
        </div>
      </section>

      <VendorProductsDeleteDialog
        state={bulkActions.deleteConfirm}
        onCancel={() => bulkActions.setDeleteConfirm(null)}
        onConfirm={bulkActions.confirmDelete}
      />

      <VendorProductDrawer
        open={showDrawer}
        form={editor.productForm}
        formErrors={editor.formErrors}
        parentCategories={editor.parentCategories}
        childCategories={editor.childCategories}
        leafCategories={editor.leafCategories}
        variantRows={editor.variantRows}
        variantStockTotal={editor.variantStockTotal}
        saving={editor.saving}
        imageUploading={editor.imageUploading}
        productImageInputRef={editor.productImageInputRef}
        onClose={editor.closeDrawer}
        onFormChange={editor.updateProductForm}
        onParentCategoryChange={(parentCategoryId) => editor.updateProductForm({ parentCategoryId, categoryId: '' })}
        onCategoryChange={(categoryId) => editor.updateProductForm({ categoryId })}
        onOpenProductImagePicker={editor.openProductImagePicker}
        onProductImagesSelected={editor.handleProductImagesSelected}
        onRemoveProductImage={editor.removeProductImage}
        onSetPrimaryProductImage={editor.setPrimaryProductImage}
        onAddVariantRow={editor.addVariantRow}
        onUpdateVariantRow={editor.updateVariantRow}
        onRemoveVariantRow={editor.removeVariantRow}
        onSave={editor.saveProduct}
      />

      <AdminToast toast={toast} />
    </VendorLayout>
  );
};

export default VendorProducts;
