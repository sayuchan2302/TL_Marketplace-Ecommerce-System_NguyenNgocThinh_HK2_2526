import './Vendor.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, FolderTree, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import VendorLayout from './VendorLayout';
import { formatCurrency } from '../../services/commissionService';
import { AdminStateBlock, AdminTableSkeleton, AdminToast } from '../Admin/AdminStateBlocks';
import AdminConfirmDialog from '../Admin/AdminConfirmDialog';
import {
  PanelStatsGrid,
  PanelTableFooter,
  PanelTabs,
  PanelViewSummary,
} from '../../components/Panel/PanelPrimitives';
import {
  vendorProductService,
  type VendorProductCategory,
  type VendorProductQuery,
  type VendorProductRecord,
  type VendorProductStatus,
} from '../../services/vendorProductService';
import { useToast } from '../../contexts/ToastContext';
import { getUiErrorMessage } from '../../utils/errorMessage';
import Drawer from '../../components/Drawer/Drawer';
import { normalizePositiveInteger } from './vendorHelpers';

type ProductTab = 'all' | 'active' | 'outOfStock' | 'draft';

interface DeleteConfirmState {
  ids: string[];
  selectedItems: string[];
  title: string;
  description: string;
  confirmLabel: string;
}

interface ProductFormState {
  id?: string;
  slug?: string;
  parentCategoryId: string;
  name: string;
  sku: string;
  categoryId: string;
  price: number;
  stock: number;
  image: string;
  description: string;
  visible: boolean;
}

interface VariantRowFormState {
  key: string;
  axis1: string;
  axis2: string;
  sku: string;
  stockQuantity: number;
  priceAdjustment: number;
  isActive: boolean;
}

const createVariantRow = (): VariantRowFormState => ({
  key: `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  axis1: '',
  axis2: '',
  sku: '',
  stockQuantity: 0,
  priceAdjustment: 0,
  isActive: true,
});

type ProductFormErrors = {
  name?: string;
  categoryId?: string;
  image?: string;
  variants?: string;
};

const PAGE_SIZE = 8;

const TABS: Array<{ key: ProductTab; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'active', label: 'Đang bán' },
  { key: 'outOfStock', label: 'Hết hàng' },
  { key: 'draft', label: 'Ẩn / nháp' },
];

const normalizeTab = (value: string | null): ProductTab => {
  if (value === 'active' || value === 'outOfStock' || value === 'draft') {
    return value;
  }
  return 'all';
};

const getStatusLabel = (status: VendorProductStatus) => {
  const map: Record<VendorProductStatus, string> = {
    active: 'Đang bán',
    low: 'Sắp hết hàng',
    out: 'Hết hàng',
    draft: 'Ẩn / nháp',
  };
  return map[status];
};

const getStatusTone = (status: VendorProductStatus) => {
  const map: Record<VendorProductStatus, string> = {
    active: 'success',
    low: 'pending',
    out: 'error',
    draft: 'neutral',
  };
  return map[status];
};

const stripDiacritics = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');

const toSkuToken = (value: string, fallback: string, maxLength = 10) => {
  const normalized = stripDiacritics(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalized) {
    return fallback;
  }

  return normalized.slice(0, maxLength);
};

const normalizeVariantAxis = (value: string) => {
  const normalized = (value || '').trim();
  return normalized || 'Default';
};

const normalizeVariantText = (value: string) => (value || '').trim();

const buildVariantKey = (axis1: string, axis2: string) =>
  `${normalizeVariantAxis(axis1)}__${normalizeVariantAxis(axis2)}`.toLowerCase();

const formPriceFromVariant = (basePrice: number, adjustment: number) =>
  Math.max(0, Number(basePrice || 0) + Number(adjustment || 0));

const emptyForm = (): ProductFormState => ({
  parentCategoryId: '',
  name: '',
  sku: '',
  categoryId: '',
  price: 0,
  stock: 0,
  image: '',
  description: '',
  visible: true,
});

const VendorProducts = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = normalizeTab(searchParams.get('status'));
  const page = normalizePositiveInteger(searchParams.get('page'));
  const keyword = (searchParams.get('q') || '').trim();

  const [searchQuery, setSearchQuery] = useState(keyword);
  const [products, setProducts] = useState<VendorProductRecord[]>([]);
  const [categories, setCategories] = useState<VendorProductCategory[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDrawer, setShowDrawer] = useState(false);
  const [productForm, setProductForm] = useState<ProductFormState>(emptyForm());
  const [formErrors, setFormErrors] = useState<ProductFormErrors>({});
  const [variantRows, setVariantRows] = useState<VariantRowFormState[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmState | null>(null);
  const [toast, setToast] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    active: 0,
    draft: 0,
    outOfStock: 0,
    lowStock: 0,
  });

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);

  const leafCategories = useMemo(
    () => categories.filter((category) => category.leaf),
    [categories],
  );

  const resolveRootCategoryId = useCallback((categoryId: string) => {
    let current = categoryById.get(categoryId);
    if (!current) {
      return '';
    }

    const visited = new Set<string>();
    while (current.parentId && !visited.has(current.parentId)) {
      visited.add(current.parentId);
      const parent = categoryById.get(current.parentId);
      if (!parent) {
        break;
      }
      current = parent;
    }

    return current.id;
  }, [categoryById]);

  const parentCategories = useMemo(() => {
    const rootIds = new Set(
      leafCategories
        .map((category) => resolveRootCategoryId(category.id))
        .filter((id) => Boolean(id)),
    );

    return categories
      .filter((category) => !category.parentId && rootIds.has(category.id))
      .sort((left, right) => left.name.localeCompare(right.name, 'vi'));
  }, [categories, leafCategories, resolveRootCategoryId]);

  const childCategories = useMemo(() => {
    if (!productForm.parentCategoryId) {
      return [];
    }

    return leafCategories
      .filter((category) => resolveRootCategoryId(category.id) === productForm.parentCategoryId)
      .sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  }, [leafCategories, productForm.parentCategoryId, resolveRootCategoryId]);

  const selectedLeafCategory = useMemo(
    () => leafCategories.find((category) => category.id === productForm.categoryId) || null,
    [leafCategories, productForm.categoryId],
  );

  const autoGeneratedSku = useMemo(() => {
    const categoryToken = toSkuToken(selectedLeafCategory?.name || 'SP', 'SP', 8);
    const productToken = toSkuToken(productForm.name, 'ITEM', 12);
    const firstVariant = variantRows[0];
    const attributeTokens = [
      toSkuToken(firstVariant?.axis1 || '', '', 8),
      toSkuToken(firstVariant?.axis2 || '', '', 8),
    ].filter((token) => Boolean(token));

    const segments = [categoryToken, productToken, ...attributeTokens].filter((segment) => Boolean(segment));
    if (segments.length === 0) {
      return '';
    }

    return segments.join('-').slice(0, 50);
  }, [productForm.name, selectedLeafCategory?.name, variantRows]);

  const variantStockTotal = useMemo(
    () => variantRows.reduce((sum, row) => sum + Math.max(0, Number(row.stockQuantity || 0)), 0),
    [variantRows],
  );

  const toastTimerRef = useRef<number | null>(null);

  const updateQuery = useCallback(
    (mutate: (query: URLSearchParams) => void, replace = false) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          mutate(next);
          return next;
        },
        { replace },
      );
    },
    [setSearchParams],
  );

  useEffect(() => {
    if (searchQuery !== keyword) {
      setSearchQuery(keyword);
    }
  }, [keyword, searchQuery]);

  useEffect(() => {
    if (searchQuery.trim() === keyword) {
      return;
    }

    const timer = window.setTimeout(() => {
      setSelected(new Set());
      updateQuery((query) => {
        const next = searchQuery.trim();
        if (next) {
          query.set('q', next);
        } else {
          query.delete('q');
        }
        query.set('page', '1');
      }, true);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [keyword, searchQuery, updateQuery]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadCategories = async () => {
      const rows = await vendorProductService.getCategories();
      if (!active) return;
      setCategories(rows);
    };
    void loadCategories();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!showDrawer || !productForm.categoryId || productForm.parentCategoryId) {
      return;
    }

    const resolvedParentId = resolveRootCategoryId(productForm.categoryId);
    if (!resolvedParentId) {
      return;
    }

    setProductForm((current) => {
      if (!current.categoryId || current.parentCategoryId) {
        return current;
      }
      return { ...current, parentCategoryId: resolvedParentId };
    });
  }, [productForm.categoryId, productForm.parentCategoryId, resolveRootCategoryId, showDrawer]);

  useEffect(() => {
    if (!showDrawer || !autoGeneratedSku) {
      return;
    }

    setProductForm((current) => {
      if (current.id && current.sku) {
        return current;
      }
      if (current.sku === autoGeneratedSku) {
        return current;
      }
      return { ...current, sku: autoGeneratedSku };
    });
  }, [autoGeneratedSku, showDrawer]);

  useEffect(() => {
    if (!showDrawer || variantRows.length === 0) {
      return;
    }

    setProductForm((current) => (current.stock === variantStockTotal
      ? current
      : { ...current, stock: variantStockTotal }));
  }, [showDrawer, variantRows.length, variantStockTotal]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const query: VendorProductQuery = {
        status: activeTab,
        keyword: keyword || undefined,
        page,
        size: PAGE_SIZE,
      };
      const response = await vendorProductService.getProducts(query);

      setProducts(response.items);
      setTotalElements(response.totalElements);
      setTotalPages(Math.max(response.totalPages, 1));
      setStatusCounts(response.statusCounts);

      setSelected((prev) => {
        const visibleIds = new Set(response.items.map((item) => item.id));
        return new Set(Array.from(prev).filter((id) => visibleIds.has(id)));
      });

      if (page > Math.max(response.totalPages, 1)) {
        updateQuery((next) => {
          next.set('page', String(Math.max(response.totalPages, 1)));
        }, true);
      }
    } catch (error: unknown) {
      const message = getUiErrorMessage(error, 'Không tải được danh sách sản phẩm của shop');
      setLoadError(message);
      addToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeTab, addToast, keyword, page, updateQuery]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const hasViewContext = activeTab !== 'all' || Boolean(keyword);
  const startIndex = products.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(page * PAGE_SIZE, totalElements);

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

  const handleTabChange = (key: string) => {
    const nextTab = normalizeTab(key);
    setSelected(new Set());
    updateQuery((query) => {
      if (nextTab === 'all') {
        query.delete('status');
      } else {
        query.set('status', nextTab);
      }
      query.set('page', '1');
    });
  };

  const setPage = (nextPage: number) => {
    updateQuery((query) => {
      query.set('page', String(Math.max(1, nextPage)));
    });
  };

  const resetCurrentView = () => {
    setSearchQuery('');
    setSelected(new Set());
    setSearchParams(new URLSearchParams());
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(products.map((product) => product.id)));
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

  const openCreateDrawer = () => {
    const nextParentId = parentCategories.length === 1 ? parentCategories[0].id : '';
    setProductForm({
      ...emptyForm(),
      parentCategoryId: nextParentId,
    });
    setVariantRows([createVariantRow()]);
    setFormErrors({});
    setShowDrawer(true);
  };

  const handleOpenCreateProductDrawer = () => {
    openCreateDrawer();
  };

  const buildVariantSku = (axis1: string, axis2: string) => {
    const categoryToken = toSkuToken(selectedLeafCategory?.name || 'SP', 'SP', 8);
    const productToken = toSkuToken(productForm.name, 'ITEM', 12);
    const axis1Token = toSkuToken(axis1, 'DEFAULT', 8);
    const axis2Token = toSkuToken(axis2, 'DEFAULT', 8);
    return [categoryToken, productToken, axis1Token, axis2Token].join('-').slice(0, 50);
  };

  const addVariantRow = () => {
    setVariantRows((current) => [...current, createVariantRow()]);
    setFormErrors((current) => {
      if (!current.variants) {
        return current;
      }
      const next = { ...current };
      delete next.variants;
      return next;
    });
  };

  const updateVariantRow = (key: string, mutate: (current: VariantRowFormState) => VariantRowFormState) => {
    setVariantRows((current) => current.map((row) => (row.key === key ? mutate(row) : row)));
  };

  const removeVariantRow = (key: string) => {
    setVariantRows((current) => {
      const next = current.filter((row) => row.key !== key);
      return next.length > 0 ? next : [createVariantRow()];
    });
  };

  const normalizeVariantRowsForSave = (rows: VariantRowFormState[]) => rows.map((row) => ({
    sku: buildVariantSku(row.axis1, row.axis2),
    color: normalizeVariantText(row.axis1),
    size: normalizeVariantText(row.axis2),
    stockQuantity: Math.max(0, Number(row.stockQuantity || 0)),
    priceAdjustment: Number(row.priceAdjustment || 0),
    isActive: row.isActive !== false,
  }));

  const openEditDrawer = (id: string) => {
    const current = products.find((product) => product.id === id);
    if (!current) return;

    setProductForm({
      id: current.id,
      slug: current.slug,
      parentCategoryId: current.categoryId ? resolveRootCategoryId(current.categoryId) : '',
      name: current.name,
      sku: current.sku,
      categoryId: current.categoryId || '',
      price: current.price,
      stock: current.stock,
      image: current.image,
      description: current.description,
      visible: current.visible,
    });
    const usedKeys = new Set<string>();
    const rows = (current.variants || []).map((variant, index) => {
      const axis1 = normalizeVariantAxis(variant.color);
      const axis2 = normalizeVariantAxis(variant.size);
      const baseKey = buildVariantKey(axis1, axis2);
      let key = baseKey;
      while (usedKeys.has(key)) {
        key = `${baseKey}__${index}`;
      }
      usedKeys.add(key);
      return {
        key,
        axis1,
        axis2,
        sku: (variant.sku || '').toUpperCase(),
        stockQuantity: Math.max(0, Number(variant.stockQuantity || 0)),
        priceAdjustment: Number(variant.priceAdjustment || 0),
        isActive: variant.isActive !== false,
      } satisfies VariantRowFormState;
    });
    setVariantRows(rows.length > 0 ? rows : [createVariantRow()]);
    setFormErrors({});
    setShowDrawer(true);
  };

  const validateForm = (
    form: ProductFormState,
    normalizedVariants: ReturnType<typeof normalizeVariantRowsForSave>,
  ) => {
    const errors: ProductFormErrors = {};
    if (!form.name.trim()) errors.name = 'Tên sản phẩm không được để trống.';
    if (!form.categoryId) errors.categoryId = 'Vui lòng chọn danh mục sản phẩm.';
    if (!form.image.trim()) errors.image = 'Vui lòng nhập ảnh đại diện sản phẩm.';
    if (normalizedVariants.length === 0) {
      errors.variants = 'Vui lòng nhập Màu sắc/Kích cỡ để tạo ít nhất một biến thể.';
    }

    if (normalizedVariants.length > 0) {
      const seen = new Set<string>();
      for (const variant of normalizedVariants) {
        if (!variant.color || !variant.size) {
          errors.variants = 'Vui lòng nhập đủ Màu sắc và Kích cỡ cho từng biến thể.';
          break;
        }
        if (!variant.sku) {
          errors.variants = 'Mỗi biến thể phải có SKU.';
          break;
        }
        if (seen.has(variant.sku)) {
          errors.variants = `SKU trùng: ${variant.sku}`;
          break;
        }
        seen.add(variant.sku);
        if (variant.stockQuantity < 0) {
          errors.variants = 'Tồn kho biến thể không được âm.';
          break;
        }
      }
    }

    return errors;
  };
  const saveProduct = async () => {
    let normalizedVariants = normalizeVariantRowsForSave(variantRows).filter((variant) => (
      variant.color || variant.size || variant.stockQuantity > 0 || variant.priceAdjustment !== 0
    ));
    const normalizedVariantPrices = normalizedVariants.map((variant) => formPriceFromVariant(productForm.price, variant.priceAdjustment));
    const variantDrivenSku = normalizedVariants[0]?.sku || '';
    const variantDrivenStock = normalizedVariants.reduce(
      (sum, variant) => sum + Math.max(0, Number(variant.stockQuantity || 0)),
      0,
    );
    const variantDrivenBasePrice = normalizedVariantPrices.length > 0
      ? Math.max(0, normalizedVariantPrices[0])
      : productForm.price;

    if (normalizedVariants.length > 0) {
      normalizedVariants = normalizedVariants.map((variant, index) => ({
        ...variant,
        priceAdjustment: Math.max(0, normalizedVariantPrices[index]) - variantDrivenBasePrice,
      }));
    }

    const normalizedForm: ProductFormState = {
      ...productForm,
      name: productForm.name.trim(),
      sku: (variantDrivenSku || productForm.sku || autoGeneratedSku || 'SP-ITEM').trim().toUpperCase(),
      description: productForm.description.trim(),
      image: productForm.image.trim(),
      price: variantDrivenBasePrice,
      stock: normalizedVariants.length > 0 ? variantDrivenStock : productForm.stock,
    };

    const errors = validateForm(normalizedForm, normalizedVariants);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      if (normalizedForm.id) {
        await vendorProductService.updateProduct(normalizedForm.id, {
          name: normalizedForm.name,
          slug: normalizedForm.slug,
          sku: normalizedForm.sku,
          categoryId: normalizedForm.categoryId || undefined,
          price: normalizedForm.price,
          stock: normalizedForm.stock,
          image: normalizedForm.image,
          description: normalizedForm.description,
          visible: normalizedForm.visible,
          variants: normalizedVariants.length > 0 ? normalizedVariants : undefined,
        });
        pushToast('Đã cập nhật sản phẩm thành công');
      } else {
        await vendorProductService.createProduct({
          name: normalizedForm.name,
          sku: normalizedForm.sku,
          categoryId: normalizedForm.categoryId || undefined,
          price: normalizedForm.price,
          stock: normalizedForm.stock,
          image: normalizedForm.image,
          description: normalizedForm.description,
          visible: normalizedForm.visible,
          variants: normalizedVariants.length > 0 ? normalizedVariants : undefined,
        });
        pushToast('Đã tạo sản phẩm mới cho gian hàng');
      }

      setShowDrawer(false);
      await loadProducts();
    } catch (error: unknown) {
      addToast(getUiErrorMessage(error, 'Không thể lưu sản phẩm'), 'error');
    } finally {
      setSaving(false);
    }
  };
  const applyVisibility = async (ids: string[], visible: boolean) => {
    setWorking(true);
    try {
      await Promise.all(ids.map((id) => vendorProductService.setVisibility(id, visible)));
      setSelected(new Set());
      pushToast(visible ? 'Đã mở hiển thị các sản phẩm đã chọn' : 'Đã ẩn các sản phẩm đã chọn');
      await loadProducts();
    } catch (error: unknown) {
      addToast(getUiErrorMessage(error, 'Không thể cập nhật trạng thái hiển thị'), 'error');
    } finally {
      setWorking(false);
    }
  };

  const requestDelete = (ids: string[]) => {
    const items = products.filter((product) => ids.includes(product.id));
    if (items.length === 0) return;

    setDeleteConfirm({
      ids,
      selectedItems: items.map((item) => item.name),
      title: ids.length > 1 ? 'Xóa các sản phẩm đã chọn' : 'Xóa sản phẩm',
      description:
        ids.length > 1
          ? 'Sản phẩm sẽ được đưa về trạng thái lưu trữ (soft delete) và ẩn khỏi storefront.'
          : 'Sản phẩm sẽ được đưa về trạng thái lưu trữ (soft delete).',
      confirmLabel: ids.length > 1 ? 'Xóa sản phẩm' : 'Xóa ngay',
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    setWorking(true);
    try {
      await Promise.all(deleteConfirm.ids.map((id) => vendorProductService.deleteProduct(id)));
      setSelected(new Set());
      pushToast(deleteConfirm.ids.length > 1 ? 'Đã xóa các sản phẩm đã chọn' : 'Đã xóa sản phẩm');
      setDeleteConfirm(null);
      await loadProducts();
    } catch (error: unknown) {
      addToast(getUiErrorMessage(error, 'Không thể xóa sản phẩm'), 'error');
    } finally {
      setWorking(false);
    }
  };

  const allSelected = products.length > 0 && selected.size === products.length;

  const tabItems = TABS.map((tab) => ({
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
      breadcrumbs={['Kênh Người Bán', 'Kho']}
      actions={(
        <button className="vendor-primary-btn" onClick={handleOpenCreateProductDrawer} disabled={working}>
          <Plus size={16} style={{ marginRight: 6 }} />
          Thêm sản phẩm
        </button>
      )}
    >
      <PanelStatsGrid
        accentClassName="vendor-stat-button"
        items={[
          { key: 'all', label: 'Tổng SKU', value: statusCounts.all, sub: 'Toàn bộ danh mục của shop', onClick: () => handleTabChange('all') },
          { key: 'active', label: 'Đang bán', value: statusCounts.active, sub: 'SKU đang hiển thị trên sàn', tone: 'success', onClick: () => handleTabChange('active') },
          { key: 'stock', label: 'Sắp hết / hết hàng', value: statusCounts.outOfStock + statusCounts.lowStock, sub: 'Cần bổ sung tồn kho', tone: 'warning', onClick: () => handleTabChange('outOfStock') },
          { key: 'draft', label: 'Ẩn / nháp', value: statusCounts.draft, sub: 'SKU chưa mở bán công khai', tone: 'info', onClick: () => handleTabChange('draft') },
        ]}
      />

      <PanelTabs items={tabItems} activeKey={activeTab} onChange={handleTabChange} accentClassName="vendor-active-tab" />

      {hasViewContext && (
        <PanelViewSummary
          chips={[
            ...(activeTab !== 'all' ? [{ key: 'status', label: `Trạng thái: ${TABS.find((tab) => tab.key === activeTab)?.label || 'Tất cả'}` }] : []),
            ...(keyword ? [{ key: 'query', label: `Từ khóa: ${keyword}` }] : []),
          ]}
          clearLabel="Xóa bộ lọc"
          onClear={resetCurrentView}
        />
      )}

      <section className="admin-panels single">
        <div className="admin-panel">
        <div className="admin-panel-head">
            <div>
              <h2>Danh sách sản phẩm</h2>
            </div>
            {selected.size > 0 && (
              <div className="admin-actions">
                <span className="admin-muted">{selected.size} đã chọn</span>
                <button className="admin-ghost-btn" onClick={() => void applyVisibility(Array.from(selected), false)} disabled={working}>Ẩn</button>
                <button className="admin-ghost-btn" onClick={() => void applyVisibility(Array.from(selected), true)} disabled={working}>Hiện</button>
                <button className="admin-ghost-btn danger" onClick={() => requestDelete(Array.from(selected))} disabled={working}>Xóa</button>
              </div>
            )}
          </div>
          {loading ? (
            <AdminTableSkeleton columns={8} rows={6} />
          ) : loadError ? (
            <AdminStateBlock type="error" title="Không tải được dữ liệu sản phẩm" description={loadError} actionLabel="Tải lại" onAction={() => void loadProducts()} />
          ) : products.length === 0 ? (
            <AdminStateBlock
              type={keyword ? 'search-empty' : 'empty'}
              title={keyword ? 'Không tìm thấy SKU phù hợp' : 'Chưa có sản phẩm nào'}
              description={keyword ? 'Thử đổi từ khóa tìm kiếm hoặc đặt lại bộ lọc.' : 'Khi shop tạo sản phẩm mới, danh sách sẽ xuất hiện tại đây.'}
              actionLabel={keyword ? 'Đặt lại bộ lọc' : 'Thêm sản phẩm'}
              onAction={keyword ? resetCurrentView : handleOpenCreateProductDrawer}
            />
          ) : (
            <>
              <div className="admin-table" role="table" aria-label="Bảng sản phẩm của gian hàng">
                <div className="admin-table-row vendor-products admin-table-head" role="row">
                  <div role="columnheader">
                    <input type="checkbox" aria-label="Chọn tất cả sản phẩm" checked={allSelected} onChange={(event) => toggleSelectAll(event.target.checked)} />
                  </div>
                  <div role="columnheader">Sản phẩm</div>
                  <div role="columnheader">Danh mục</div>
                  <div role="columnheader">Giá bán</div>
                  <div role="columnheader">Tồn kho</div>
                  <div role="columnheader">Đã bán</div>
                  <div role="columnheader">Trạng thái</div>
                  <div role="columnheader">Hành động</div>
                </div>

                {products.map((product, index) => (
                  <motion.div
                    key={product.id}
                    className={`admin-table-row vendor-products ${product.status === 'draft' ? 'row-muted' : ''}`}
                    role="row"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(index * 0.025, 0.14) }}
                    whileHover={{ y: -1 }}
                    onClick={() => openEditDrawer(product.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div role="cell" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" aria-label={`Chọn ${product.name}`} checked={selected.has(product.id)} onChange={(event) => toggleOne(product.id, event.target.checked)} />
                    </div>
                    <div role="cell" className="vendor-admin-product-cell">
                      <img src={product.image} alt={product.name} className="vendor-admin-thumb" />
                      <div className="vendor-admin-product-copy">
                        <div className="admin-bold">{product.name}</div>
                        <div className="admin-muted small">SKU: {product.sku}</div>
                      </div>
                    </div>
                    <div role="cell" className="vendor-admin-category">
                      <FolderTree size={14} />
                      <span>{product.category}</span>
                    </div>
                    <div role="cell" className="admin-bold">{formatCurrency(product.price)}</div>
                    <div role="cell">
                      <span className={`badge ${product.stock === 0 ? 'red' : product.stock < 10 ? 'amber' : 'blue'}`}>
                        {product.stock} sản phẩm
                      </span>
                    </div>
                    <div role="cell" className="admin-muted">{product.sold} đã bán</div>
                    <div role="cell">
                      <span className={`admin-pill ${getStatusTone(product.status)}`}>{getStatusLabel(product.status)}</span>
                    </div>
                    <div role="cell" className="admin-actions" onClick={(event) => event.stopPropagation()}>
                      <button className="admin-icon-btn subtle" title="Chỉnh sửa sản phẩm" onClick={() => openEditDrawer(product.id)}>
                        <Pencil size={16} />
                      </button>
                      <button className="admin-icon-btn subtle" title={product.visible ? 'Ẩn sản phẩm' : 'Hiển thị sản phẩm'} onClick={() => void applyVisibility([product.id], !product.visible)} disabled={working}>
                        {product.visible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button className="admin-icon-btn subtle danger-icon" title="Xóa sản phẩm" onClick={() => requestDelete([product.id])} disabled={working}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>

              <PanelTableFooter
                meta={`Hiển thị ${startIndex}-${endIndex} trên ${totalElements} sản phẩm`}
                page={page}
                totalPages={Math.max(totalPages, 1)}
                onPageChange={setPage}
                activePageClassName="vendor-active-page"
                nextLabel="Sau"
              />
            </>
          )}
        </div>
      </section>

      <AdminConfirmDialog
        open={Boolean(deleteConfirm)}
        title={deleteConfirm?.title || 'Xác nhận xóa'}
        description={deleteConfirm?.description || ''}
        selectedItems={deleteConfirm?.selectedItems}
        selectedNoun="sản phẩm"
        confirmLabel={deleteConfirm?.confirmLabel || 'Xóa'}
        danger
        onCancel={() => setDeleteConfirm(null)}
        onConfirm={() => void confirmDelete()}
      />

      <Drawer open={showDrawer} onClose={() => setShowDrawer(false)}>
        <div className="drawer-header vendor-product-drawer-header">
          <div>
            <p className="drawer-eyebrow">{productForm.id ? 'Chỉnh sửa sản phẩm' : 'Tạo sản phẩm mới'}</p>
            <h3>{productForm.name || 'Sản phẩm mới'}</h3>
          </div>
          <button className="admin-icon-btn" onClick={() => setShowDrawer(false)} aria-label="Đóng biểu mẫu sản phẩm">
            <X size={16} />
          </button>
        </div>

        <div className="drawer-body">
          <section className="drawer-section">
            <h4>Thông tin sản phẩm</h4>
            <div className="form-grid">
              <label className="form-field full">
                <span>Tên sản phẩm</span>
                <input value={productForm.name} onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} />
                {formErrors.name && <small className="form-field-error">{formErrors.name}</small>}
              </label>

              <div className="form-field full vendor-product-category-block">
                <span>Danh mục sản phẩm</span>
                <div className="vendor-product-category-grid">
                  <label className="form-field">
                    <span>Danh mục cha</span>
                    <select
                      value={productForm.parentCategoryId}
                      onChange={(event) => setProductForm((current) => ({
                        ...current,
                        parentCategoryId: event.target.value,
                        categoryId: '',
                      }))}
                    >
                      <option value="">Chọn danh mục cha</option>
                      {parentCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Danh mục con</span>
                    <select
                      value={productForm.categoryId}
                      onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))}
                      disabled={!productForm.parentCategoryId}
                    >
                      <option value="">{productForm.parentCategoryId ? 'Chọn danh mục con' : 'Chọn danh mục cha trước'}</option>
                      {childCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {leafCategories.length === 0 && (
                  <small className="admin-muted">Chưa có danh mục. Vui lòng nhờ admin tạo danh mục trước khi đăng sản phẩm.</small>
                )}
                {formErrors.categoryId && <small className="form-field-error">{formErrors.categoryId}</small>}
              </div>

              <label className="form-field">
                <span>Ảnh sản phẩm (URL)</span>
                <input value={productForm.image} onChange={(event) => setProductForm((current) => ({ ...current, image: event.target.value }))} placeholder="https://..." />
                {formErrors.image && <small className="form-field-error">{formErrors.image}</small>}
              </label>

              <div className="form-field vendor-product-image-preview">
                <span>Xem trước ảnh</span>
                <div className="vendor-product-image-preview-card">
                  {productForm.image.trim() ? (
                    <img src={productForm.image} alt={productForm.name || 'Ảnh sản phẩm'} />
                  ) : (
                    <p className="admin-muted small">Thêm URL ảnh để xem trước.</p>
                  )}
                </div>
              </div>

            </div>
          </section>

          <section className="drawer-section">
            <div className="vendor-variant-builder-head">
              <div>
                <h4>Danh sách biến thể</h4>
              </div>
              <button type="button" className="admin-ghost-btn small" onClick={addVariantRow}>
                Thêm biến thể
              </button>
            </div>

            {formErrors.variants && <small className="form-field-error">{formErrors.variants}</small>}
            <div className="vendor-variant-table">
              <div className="vendor-variant-row vendor-variant-row-head">
                <div>Màu sắc</div>
                <div>Kích cỡ</div>
                <div>Số lượng</div>
                <div>Giá bán</div>
                <div>Hiển thị</div>
                <div />
              </div>

              {variantRows.map((row) => (
                <div key={row.key} className="vendor-variant-row">
                  <div>
                    <input
                      type="text"
                      placeholder="Ví dụ: Đen"
                      value={row.axis1}
                      onChange={(event) => updateVariantRow(row.key, (current) => ({
                        ...current,
                        axis1: event.target.value,
                      }))}
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      placeholder="Ví dụ: M"
                      value={row.axis2}
                      onChange={(event) => updateVariantRow(row.key, (current) => ({
                        ...current,
                        axis2: event.target.value,
                      }))}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      value={row.stockQuantity}
                      onChange={(event) => updateVariantRow(row.key, (current) => ({
                        ...current,
                        stockQuantity: Math.max(0, Number(event.target.value || 0)),
                      }))}
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={Math.max(0, productForm.price + row.priceAdjustment)}
                      onChange={(event) => updateVariantRow(row.key, (current) => ({
                        ...current,
                        priceAdjustment: Math.max(0, Number(event.target.value || 0)) - productForm.price,
                      }))}
                    />
                  </div>
                  <div className="vendor-variant-active">
                    <input
                      type="checkbox"
                      checked={row.isActive}
                      onChange={(event) => updateVariantRow(row.key, (current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))}
                    />
                  </div>
                  <div className="vendor-variant-actions">
                    <button
                      type="button"
                      className="admin-icon-btn subtle danger-icon"
                      title="Xóa dòng biến thể"
                      onClick={() => removeVariantRow(row.key)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p className="admin-muted small vendor-variant-total">
              Tổng kho: {variantStockTotal}
            </p>
          </section>

          <section className="drawer-section">
            <h4>Mô tả sản phẩm</h4>
            <label className="form-field full">
              <span>Mô tả chi tiết</span>
              <textarea
                rows={5}
                value={productForm.description}
                onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Mô tả chất liệu, form dáng, điểm nổi bật và lưu ý sử dụng để khách dễ quyết định mua hàng."
              />
            </label>
          </section>

        </div>

        <div className="drawer-footer">
          <button className="admin-ghost-btn" onClick={() => setShowDrawer(false)} disabled={saving}>Hủy</button>
          <button
            className="admin-primary-btn vendor-admin-primary"
            onClick={() => void saveProduct()}
            disabled={saving || leafCategories.length === 0}
          >
            {saving ? 'Đang lưu...' : productForm.id ? 'Lưu cập nhật' : 'Tạo sản phẩm'}
          </button>
        </div>
      </Drawer>

      <AdminToast toast={toast} />
    </VendorLayout>
  );
};

export default VendorProducts;
