import { apiRequest } from './apiClient';
import { storeService, type StoreProfile } from './storeService';
import { getOptimizedImageUrl } from '../utils/getOptimizedImageUrl';

interface BackendPage<T> {
  content?: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
}

interface BackendVendorOrderItem {
  id?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  name?: string;
  sku?: string;
  variant?: string;
  image?: string;
}

interface BackendVendorAddress {
  fullName?: string;
  phone?: string;
  address?: string;
  ward?: string;
  district?: string;
  city?: string;
}

interface BackendVendorCustomer {
  name?: string;
  email?: string;
  phone?: string;
}

interface BackendVendorOrderSummary {
  id: string;
  code?: string;
  vendorId?: string;
  vendorName?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  total?: number;
  commissionFee?: number;
  vendorPayout?: number;
  itemCount?: number;
  customer?: BackendVendorCustomer;
  trackingNumber?: string;
  shippingCarrier?: string;
  warehouseNote?: string;
}

interface BackendVendorOrderDetail extends BackendVendorOrderSummary {
  subtotal?: number;
  shippingFee?: number;
  discount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
  note?: string;
  items?: BackendVendorOrderItem[];
  shippingAddress?: BackendVendorAddress;
}

interface BackendVendorOrderPage {
  content?: BackendVendorOrderSummary[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
  statusCounts?: {
    all?: number;
    pending?: number;
    confirmed?: number;
    processing?: number;
    shipped?: number;
    delivered?: number;
    cancelled?: number;
  };
}

interface BackendProduct {
  id: string;
  name?: string;
  effectivePrice?: number;
  basePrice?: number;
  salePrice?: number;
  totalStock?: number;
  soldCount?: number;
  grossRevenue?: number;
  primaryImage?: string;
}

interface BackendTopProduct {
  productId?: string;
  productName?: string;
  productImage?: string;
  soldCount?: number;
  grossRevenue?: number;
}

interface VendorStatsResponse {
  totalOrders?: number;
  pendingOrders?: number;
  confirmedOrders?: number;
  processingOrders?: number;
  shippedOrders?: number;
  deliveredOrders?: number;
  cancelledOrders?: number;
  totalRevenue?: number;
  totalPayout?: number;
}

export interface VendorDashboardData {
  stats: {
    todayOrders: number;
    pendingOrders: number;
    totalRevenue: number;
    totalPayout: number;
    totalProducts: number;
    rating: number;
    commissionRate: number;
  };
  recentOrders: VendorOrderSummary[];
  topProducts: VendorTopProduct[];
}

export interface VendorOrderSummary {
  id: string;
  code: string;
  customer: string;
  email: string;
  total: number;
  status: VendorOrderLifecycleStatus;
  date: string;
  items: number;
  commissionFee: number;
  vendorPayout: number;
  thumb?: string;
}

export type VendorOrderLifecycleStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export interface VendorOrdersPage {
  items: VendorOrderSummary[];
  totalElements: number;
  totalPages: number;
  page: number;
  pageSize: number;
  statusCounts?: Record<string, number>;
}

export interface VendorOrderDetailData {
  id: string;
  code: string;
  status: VendorOrderLifecycleStatus;
  createdAt: string;
  updatedAt?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    fullName: string;
    phone: string;
    address: string;
    ward: string;
    district: string;
    city: string;
  };
  items: Array<{
    id: string;
    name: string;
    sku: string;
    variant: string;
    price: number;
    quantity: number;
    image: string;
  }>;
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  note: string;
  warehouseNote: string;
  trackingNumber: string;
  carrier: string;
  commissionFee: number;
  vendorPayout: number;
  timeline: Array<{ status: string; date: string; note: string }>;
}

export interface VendorTopProduct {
  id: string;
  name: string;
  sales: number;
  stock?: number;
  revenue: number;
  img: string;
}

export interface VendorSettingsData {
  storeInfo: {
    name: string;
    slug: string;
    description: string;
    logo: string;
    banner: string;
    contactEmail: string;
    phone: string;
    address: string;
  };
  bankInfo: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    verified: boolean;
  };
  notifications: {
    newOrder: boolean;
    orderStatusChange: boolean;
    lowStock: boolean;
    payoutComplete: boolean;
    promotions: boolean;
  };
  shipping: {
    ghn: boolean;
    ghtk: boolean;
    express: boolean;
    warehouseAddress: string;
    warehouseContact: string;
    warehousePhone: string;
  };
}

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=100&h=120&fit=crop';

const DEFAULT_SETTINGS: VendorSettingsData = {
  storeInfo: {
    name: 'Fashion House',
    slug: 'fashion-house',
    description: 'Tinh chỉnh trải nghiệm cửa hàng, logistics và thông tin liên hệ tại đây.',
    logo: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&h=200&fit=crop',
    banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&h=600&fit=crop',
    contactEmail: 'contact@fashionhouse.vn',
    phone: '0901234567',
    address: '123 Nguyen Hue, Quan 1, TP.HCM',
  },
  bankInfo: {
    bankName: 'Vietcombank',
    accountNumber: '****6789',
    accountHolder: 'NGUYEN VAN A',
    verified: true,
  },
  notifications: {
    newOrder: true,
    orderStatusChange: true,
    lowStock: true,
    payoutComplete: true,
    promotions: false,
  },
  shipping: {
    ghn: true,
    ghtk: true,
    express: false,
    warehouseAddress: '123 Nguyen Hue, Quan 1, TP.HCM',
    warehouseContact: 'Nguyen Van A',
    warehousePhone: '0901234567',
  },
};

const mapBackendStatus = (status?: string): VendorOrderLifecycleStatus => {
  switch ((status || '').toUpperCase()) {
    case 'CONFIRMED':
      return 'confirmed';
    case 'PROCESSING':
      return 'processing';
    case 'SHIPPED':
      return 'shipped';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const mapOrderSummary = (order: BackendVendorOrderSummary): VendorOrderSummary => {
  const total = Number(order.total || 0);

  return {
    id: order.id,
    code: order.code || '',
    customer: order.customer?.name || 'Khách hàng',
    email: order.customer?.email || '',
    total,
    status: mapBackendStatus(order.status),
    date: order.createdAt || new Date().toISOString(),
    items: Number(order.itemCount || 0),
    commissionFee: Number(order.commissionFee ?? 0),
    vendorPayout: Number(order.vendorPayout ?? 0),
    thumb: FALLBACK_IMAGE,
  };
};

const mapOrderDetail = (order: BackendVendorOrderDetail): VendorOrderDetailData => ({
  id: order.id,
  code: order.code || '',
  status: mapBackendStatus(order.status),
  createdAt: order.createdAt || new Date().toISOString(),
  updatedAt: order.updatedAt || order.createdAt || new Date().toISOString(),
  customer: {
    name: order.customer?.name || order.shippingAddress?.fullName || 'Khách hàng',
    email: order.customer?.email || '',
    phone: order.customer?.phone || order.shippingAddress?.phone || '',
  },
  shippingAddress: {
    fullName: order.shippingAddress?.fullName || order.customer?.name || 'Khách hàng',
    phone: order.shippingAddress?.phone || order.customer?.phone || '',
    address: order.shippingAddress?.address || '',
    ward: order.shippingAddress?.ward || '',
    district: order.shippingAddress?.district || '',
    city: order.shippingAddress?.city || '',
  },
  items: (order.items || []).map((item, index) => ({
    id: item.id || `${order.id}-${index}`,
    name: item.name || 'Sản phẩm',
    sku: item.sku || item.id || `ITEM-${index + 1}`,
    variant: item.variant || 'Mặc định',
    price: Number(item.unitPrice || item.totalPrice || 0),
    quantity: Number(item.quantity || 0),
    image: getOptimizedImageUrl(item.image || FALLBACK_IMAGE, { width: 100, format: 'webp' }),
  })),
  subtotal: Number(order.subtotal || 0),
  shippingFee: Number(order.shippingFee || 0),
  discount: Number(order.discount || 0),
  total: Number(order.total || 0),
  paymentMethod: order.paymentMethod || 'COD',
  paymentStatus: (order.paymentStatus || 'UNPAID').toLowerCase(),
  note: order.note || '',
  warehouseNote: order.warehouseNote || '',
  trackingNumber: order.trackingNumber || '',
  carrier: order.shippingCarrier || '',
  commissionFee: Number(order.commissionFee ?? 0),
  vendorPayout: Number(order.vendorPayout ?? 0),
  timeline: [
    {
      status: mapBackendStatus(order.status),
      date: order.updatedAt || order.createdAt || new Date().toISOString(),
      note: order.note || 'Đơn hàng đã được đồng bộ từ hệ thống.',
    },
  ],
});

const mapBackendTopProduct = (
  product: BackendTopProduct,
  index: number,
): VendorTopProduct => ({
  id: product.productId ? String(product.productId) : `top-${index}`,
  name: product.productName || 'Sản phẩm',
  sales: Number(product.soldCount || 0),
  revenue: Number(product.grossRevenue || 0),
  img: product.productImage || FALLBACK_IMAGE,
});

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toStartOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());

const dateKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dateLabel = (value: Date) =>
  `${String(value.getDate()).padStart(2, '0')}/${String(value.getMonth() + 1).padStart(2, '0')}`;

const isoDate = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;

const toValidDate = (raw?: string) => {
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getDaysAgo = (raw?: string) => {
  const parsed = toValidDate(raw);
  if (!parsed) return null;
  const nowStart = toStartOfDay(new Date()).getTime();
  const orderStart = toStartOfDay(parsed).getTime();
  return Math.floor((nowStart - orderStart) / DAY_IN_MS);
};

const summarizeWindow = (orders: VendorOrderSummary[], fromDaysAgo: number, toDaysAgo: number) => {
  const scoped = orders.filter((order) => {
    const daysAgo = getDaysAgo(order.date);
    return daysAgo !== null && daysAgo >= fromDaysAgo && daysAgo < toDaysAgo;
  });

  const revenue = scoped.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const payout = scoped.reduce((sum, order) => sum + Number(order.vendorPayout || 0), 0);
  const commission = scoped.reduce((sum, order) => sum + Number(order.commissionFee || 0), 0);
  const count = scoped.length;
  const deliveredCount = scoped.filter((order) => order.status === 'delivered').length;

  return {
    revenue: Math.round(revenue),
    payout: Math.round(payout),
    commission: Math.round(commission),
    orders: count,
    avgOrderValue: count > 0 ? Math.round(revenue / count) : 0,
    conversionRate: count > 0 ? Number(((deliveredCount / count) * 100).toFixed(1)) : 0,
  };
};

const buildDailySeries = (orders: VendorOrderSummary[], days = 7) => {
  const now = toStartOfDay(new Date());
  const buckets = new Map<string, { date: string; revenue: number; payout: number; commission: number; orders: number }>();

  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(now);
    current.setDate(now.getDate() - index);
    buckets.set(dateKey(current), { date: dateLabel(current), revenue: 0, payout: 0, commission: 0, orders: 0 });
  }

  orders.forEach((order) => {
    const parsed = toValidDate(order.date);
    if (!parsed) return;
    const key = dateKey(toStartOfDay(parsed));
    const bucket = buckets.get(key);
    if (!bucket) return;
    bucket.orders += 1;
    bucket.revenue += Number(order.total || 0);
    bucket.payout += Number(order.vendorPayout || 0);
    bucket.commission += Number(order.commissionFee || 0);
  });

  return Array.from(buckets.values());
};

const toVendorSettings = (store: StoreProfile): VendorSettingsData => ({
  storeInfo: {
    name: store.name || '',
    slug: store.slug || '',
    description: store.description || '',
    logo: store.logo || '',
    banner: store.banner || '',
    contactEmail: store.contactEmail || '',
    phone: store.phone || '',
    address: store.address || '',
  },
  bankInfo: {
    bankName: store.bankName || '',
    accountNumber: store.bankAccountNumber || '',
    accountHolder: store.bankAccountHolder || '',
    verified: Boolean(store.bankVerified),
  },
  notifications: {
    newOrder: store.notifyNewOrder ?? DEFAULT_SETTINGS.notifications.newOrder,
    orderStatusChange: store.notifyOrderStatusChange ?? DEFAULT_SETTINGS.notifications.orderStatusChange,
    lowStock: store.notifyLowStock ?? DEFAULT_SETTINGS.notifications.lowStock,
    payoutComplete: store.notifyPayoutComplete ?? DEFAULT_SETTINGS.notifications.payoutComplete,
    promotions: store.notifyPromotions ?? DEFAULT_SETTINGS.notifications.promotions,
  },
  shipping: {
    ghn: store.shipGhn ?? DEFAULT_SETTINGS.shipping.ghn,
    ghtk: store.shipGhtk ?? DEFAULT_SETTINGS.shipping.ghtk,
    express: store.shipExpress ?? DEFAULT_SETTINGS.shipping.express,
    warehouseAddress: store.warehouseAddress || store.address || DEFAULT_SETTINGS.shipping.warehouseAddress,
    warehouseContact: store.warehouseContact || '',
    warehousePhone: store.warehousePhone || store.phone || '',
  },
});

const toCanonicalSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const validateSettingsBeforeSave = (payload: VendorSettingsData) => {
  const hasCarrier = payload.shipping.ghn || payload.shipping.ghtk || payload.shipping.express;
  if (!hasCarrier) return;

  if (!payload.shipping.warehouseAddress.trim()) {
    throw new Error('Cần địa chỉ kho khi bật đơn vị vận chuyển.');
  }

  if (!payload.shipping.warehouseContact.trim()) {
    throw new Error('Cần người phụ trách kho khi bật đơn vị vận chuyển.');
  }

  if (!payload.shipping.warehousePhone.trim()) {
    throw new Error('Cần số điện thoại kho khi bật đơn vị vận chuyển.');
  }
};

export const vendorPortalService = {
  async getDashboardData(): Promise<VendorDashboardData> {
    const today = isoDate(new Date());
    const [stats, store, orders, products, todayOrdersPage, topProducts] = await Promise.all([
      apiRequest<VendorStatsResponse>('/api/orders/my-store/stats', {}, { auth: true }),
      storeService.getMyStore(),
      apiRequest<BackendVendorOrderPage>('/api/vendor/orders?page=0&size=5', {}, { auth: true }),
      apiRequest<BackendPage<BackendProduct>>('/api/products/my-store?page=0&size=1', {}, { auth: true }),
      apiRequest<BackendVendorOrderPage>(`/api/vendor/orders?page=0&size=1&date_from=${today}&date_to=${today}`, {}, { auth: true }),
      apiRequest<BackendTopProduct[]>(
        '/api/orders/my-store/top-products?days=30&limit=3',
        {},
        { auth: true },
      ),
    ]);
    const todayOrders = Number(todayOrdersPage.totalElements || 0);

    return {
      stats: {
        todayOrders,
        pendingOrders: Number(stats.pendingOrders || 0),
        totalRevenue: Number(stats.totalRevenue || 0),
        totalPayout: Number(stats.totalPayout || 0),
        totalProducts: Number(products.totalElements || products.content?.length || 0),
        rating: store.rating,
        commissionRate: store.commissionRate ?? 5,
      },
      recentOrders: (orders.content || []).map(mapOrderSummary),
      topProducts: (topProducts || []).map((item, index) => mapBackendTopProduct(item, index)),
    };
  },

  async getOrders(params: {
    status?: 'all' | VendorOrderLifecycleStatus;
    page?: number;
    size?: number;
    keyword?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}): Promise<VendorOrdersPage> {
    const page = Math.max(0, (params.page ?? 1) - 1);
    const size = params.size ?? 10;

    const searchParams = new URLSearchParams();
    searchParams.set('page', String(page));
    searchParams.set('size', String(size));
    if (params.status && params.status !== 'all') {
      searchParams.set('status', params.status);
    }
    if (params.keyword?.trim()) searchParams.set('q', params.keyword.trim());
    if (params.dateFrom) searchParams.set('date_from', params.dateFrom);
    if (params.dateTo) searchParams.set('date_to', params.dateTo);

    const response = await apiRequest<BackendVendorOrderPage>(
      `/api/vendor/orders?${searchParams.toString()}`,
      {},
      { auth: true },
    );

    const content = response.content || [];
    const statusCounts = response.statusCounts || {};
    return {
      items: content.map(mapOrderSummary),
      totalElements: Number(response.totalElements ?? content.length),
      totalPages: Number(response.totalPages ?? 1),
      page: Number(response.number ?? page) + 1,
      pageSize: Number(response.size ?? size),
      statusCounts: {
        pending: Number(statusCounts.pending || 0),
        confirmed: Number(statusCounts.confirmed || 0),
        processing: Number(statusCounts.processing || 0),
        shipped: Number(statusCounts.shipped || 0),
        delivered: Number(statusCounts.delivered || 0),
        cancelled: Number(statusCounts.cancelled || 0),
        all: Number(statusCounts.all || 0),
      },
    };
  },

  async getOrderDetail(id: string): Promise<VendorOrderDetailData> {
    const path = UUID_PATTERN.test(id)
      ? `/api/vendor/orders/${id}`
      : `/api/vendor/orders/code/${encodeURIComponent(id)}`;
    const order = await apiRequest<BackendVendorOrderDetail>(path, {}, { auth: true });
    return mapOrderDetail(order);
  },

  async updateOrderStatus(
    id: string,
    status: 'CONFIRMED' | 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED',
    payload?: { trackingNumber?: string; carrier?: string; reason?: string },
  ) {
    await apiRequest(`/api/vendor/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...payload }),
    }, { auth: true });
  },

  async notifyDelay(id: string, warehouseNote: string) {
    await apiRequest(`/api/vendor/orders/${id}/delay`, {
      method: 'PATCH',
      body: JSON.stringify({ warehouseNote }),
    }, { auth: true });
  },

  async getSettings(): Promise<VendorSettingsData> {
    const store = await storeService.getMyStore();
    return toVendorSettings(store);
  },

  async updateSettings(payload: VendorSettingsData) {
    validateSettingsBeforeSave(payload);
    const updatedStore = await storeService.updateMyStore({
      name: payload.storeInfo.name,
      slug: toCanonicalSlug(payload.storeInfo.slug || payload.storeInfo.name),
      description: payload.storeInfo.description,
      logo: payload.storeInfo.logo,
      banner: payload.storeInfo.banner,
      contactEmail: payload.storeInfo.contactEmail,
      phone: payload.storeInfo.phone,
      address: payload.storeInfo.address,
      bankName: payload.bankInfo.bankName,
      bankAccountNumber: payload.bankInfo.accountNumber,
      bankAccountHolder: payload.bankInfo.accountHolder,
      bankVerified: payload.bankInfo.verified,
      notifyNewOrder: payload.notifications.newOrder,
      notifyOrderStatusChange: payload.notifications.orderStatusChange,
      notifyLowStock: payload.notifications.lowStock,
      notifyPayoutComplete: payload.notifications.payoutComplete,
      notifyPromotions: payload.notifications.promotions,
      shipGhn: payload.shipping.ghn,
      shipGhtk: payload.shipping.ghtk,
      shipExpress: payload.shipping.express,
      warehouseAddress: payload.shipping.warehouseAddress,
      warehouseContact: payload.shipping.warehouseContact,
      warehousePhone: payload.shipping.warehousePhone,
    });

    return toVendorSettings(updatedStore);
  },

  async getAnalytics(params: { topProductsDays?: 1 | 7 | 30; topProductsLimit?: number } = {}) {
    const pageSize = 200;
    const topProductsDays = params.topProductsDays === 1 || params.topProductsDays === 7 || params.topProductsDays === 30
      ? params.topProductsDays
      : 30;
    const topProductsLimit = Math.min(Math.max(params.topProductsLimit ?? 5, 1), 20);

    const [store, firstOrdersPage, topProducts] = await Promise.all([
      storeService.getMyStore(),
      this.getOrders({ page: 1, size: pageSize }),
      apiRequest<BackendTopProduct[]>(
        `/api/orders/my-store/top-products?days=${topProductsDays}&limit=${topProductsLimit}`,
        {},
        { auth: true },
      ),
    ]);

    let recentOrders = [...firstOrdersPage.items];
    if (firstOrdersPage.totalPages > 1) {
      const pendingRequests: Array<Promise<VendorOrdersPage>> = [];
      for (let nextPage = 2; nextPage <= firstOrdersPage.totalPages; nextPage += 1) {
        pendingRequests.push(this.getOrders({ page: nextPage, size: pageSize }));
      }
      const remainingPages = await Promise.all(pendingRequests);
      recentOrders = recentOrders.concat(remainingPages.flatMap((page) => page.items));
    }

    const todayCurrent = summarizeWindow(recentOrders, 0, 1);
    const todayPrevious = summarizeWindow(recentOrders, 1, 2);
    const weekCurrent = summarizeWindow(recentOrders, 0, 7);
    const weekPrevious = summarizeWindow(recentOrders, 7, 14);
    const monthCurrent = summarizeWindow(recentOrders, 0, 30);
    const monthPrevious = summarizeWindow(recentOrders, 30, 60);

    return {
      periods: {
        today: {
          revenue: todayCurrent.revenue,
          payout: todayCurrent.payout,
          commission: todayCurrent.commission,
          orders: todayCurrent.orders,
          avgOrderValue: todayCurrent.avgOrderValue,
          conversionRate: todayCurrent.conversionRate,
          previousRevenue: todayPrevious.revenue,
          previousPayout: todayPrevious.payout,
          previousCommission: todayPrevious.commission,
          previousOrders: todayPrevious.orders,
        },
        week: {
          revenue: weekCurrent.revenue,
          payout: weekCurrent.payout,
          commission: weekCurrent.commission,
          orders: weekCurrent.orders,
          avgOrderValue: weekCurrent.avgOrderValue,
          conversionRate: weekCurrent.conversionRate,
          previousRevenue: weekPrevious.revenue,
          previousPayout: weekPrevious.payout,
          previousCommission: weekPrevious.commission,
          previousOrders: weekPrevious.orders,
        },
        month: {
          revenue: monthCurrent.revenue,
          payout: monthCurrent.payout,
          commission: monthCurrent.commission,
          orders: monthCurrent.orders,
          avgOrderValue: monthCurrent.avgOrderValue,
          conversionRate: monthCurrent.conversionRate,
          previousRevenue: monthPrevious.revenue,
          previousPayout: monthPrevious.payout,
          previousCommission: monthPrevious.commission,
          previousOrders: monthPrevious.orders,
        },
      },
      dailyData: buildDailySeries(recentOrders, 7),
      topProducts: (topProducts || []).map((product, index) => mapBackendTopProduct(product, index)),
      commissionRate: store.commissionRate ?? 5,
    };
  },
};
