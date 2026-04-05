/**
 * orderService.ts — Client-facing order operations.
 * Now reads/writes through sharedOrderStore (unified with AdminOrders).
 * 
 * Multi-vendor: Supports sub-order splitting by store.
 */
import { sharedOrderStore, fulfillmentToClientStatus, clientStatusToFulfillment, type SharedOrder, type ClientOrderStatus } from './sharedOrderStore';
import { ApiError, apiRequest } from './apiClient';
import type { Order, OrderStatus, OrderItem, OrderStatusStep } from '../types';



interface BackendOrderRequestItem {
  productId: string;
  variantId?: string;
  quantity: number;
  unitPrice?: number;
}

interface BackendAddressSummary {
  fullName?: string;
  phone?: string;
  address?: string;
  detail?: string;
  ward?: string;
  district?: string;
  city?: string;
  province?: string;
}

interface BackendOrderItemResponse {
  id?: string;
  name?: string;
  sku?: string;
  image?: string;
  productName?: string;
  variantName?: string;
  productImage?: string;
  variant?: string;
  quantity?: number;
  price?: number;
  unitPrice?: number;
  totalPrice?: number;
}

interface BackendOrderResponse {
  id: string;
  code?: string;
  createdAt?: string;
  status?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  subtotal?: number;
  shippingFee?: number;
  discount?: number;
  total?: number;
  carrier?: string;
  note?: string;
  trackingNumber?: string;
  couponCode?: string;
  subOrderId?: string | null;
  storeId?: string | null;
  storeName?: string | null;
  items?: BackendOrderItemResponse[];
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  shippingAddress?: BackendAddressSummary;
}

interface BackendOrderTreeItem {
  id?: string;
  name?: string;
  sku?: string;
  variant?: string;
  quantity?: number;
  unitPrice?: number;
  totalPrice?: number;
  image?: string;
}

interface BackendOrderTreeSubOrder {
  id?: string;
  code?: string;
  vendorId?: string;
  vendorName?: string;
  status?: string;
  totalAmount?: number;
  trackingNumber?: string;
  warehouseNote?: string;
  createdAt?: string;
  items?: BackendOrderTreeItem[];
}

interface BackendOrderTreeResponse {
  id: string;
  code?: string;
  createdAt?: string;
  status?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  subtotal?: number;
  shippingFee?: number;
  discount?: number;
  totalAmount?: number;
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  shippingAddress?: BackendAddressSummary;
  items?: BackendOrderTreeItem[];
  subOrders?: BackendOrderTreeSubOrder[];
}



const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_CODE_PATTERN = /^DH-\d{6}-\d{6}$/i;

const backendStatusToClientStatus = (status?: string): ClientOrderStatus => {
  switch ((status || '').toUpperCase()) {
    case 'CONFIRMED':
    case 'PROCESSING':
      return 'processing';
    case 'SHIPPED':
      return 'shipping';
    case 'DELIVERED':
      return 'delivered';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'pending';
  }
};

const backendPaymentStatusToClient = (status?: string, paymentMethod?: string) => {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'PAID') return 'paid' as const;
  if (normalized === 'REFUND_PENDING') return 'refund_pending' as const;
  if (normalized === 'REFUNDED') return 'refunded' as const;
  if (paymentMethod?.toUpperCase() === 'COD') return 'cod_uncollected' as const;
  return 'unpaid' as const;
};

const formatBackendAddress = (address?: BackendAddressSummary) =>
  [address?.detail || address?.address, address?.ward, address?.district, address?.province || address?.city]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(', ');

const mapBackendOrderToShared = (order: BackendOrderResponse): SharedOrder => {
  const clientStatus = backendStatusToClientStatus(order.status);
  return {
    id: order.id,
    code: order.code || order.id,
    createdAt: order.createdAt || new Date().toISOString(),
    parentOrderId: order.subOrderId || undefined,
    storeId: order.storeId || undefined,
    storeName: order.storeName || undefined,
    customerName: order.shippingAddress?.fullName || order.customer?.name || 'Khách hàng',
    customerEmail: order.customer?.email || '',
    customerPhone: order.shippingAddress?.phone || order.customer?.phone || '',
    customerAvatar: 'KH',
    address: formatBackendAddress(order.shippingAddress),
    shipMethod: order.carrier || 'Marketplace delivery',
    tracking: order.trackingNumber || '',
    note: order.note || '',
    paymentMethod: order.paymentMethod || 'COD',
    paymentStatus: backendPaymentStatusToClient(order.paymentStatus, order.paymentMethod),
    couponCode: order.couponCode,
    fulfillment: clientStatusToFulfillment(clientStatus),
    items: (order.items || []).map((item, index) => ({
      id: item.id || `${order.id}-${index + 1}`,
      name: item.name || item.productName || `Item ${index + 1}`,
      price: Number(item.price || item.unitPrice || 0),
      image: item.image || item.productImage || '',
      quantity: item.quantity || 0,
      size: item.variant || item.variantName,
    })),
    subtotal: Number(order.subtotal || 0),
    shippingFee: Number(order.shippingFee || 0),
    discount: Number(order.discount || 0),
    total: Number(order.total || 0),
    timeline: [
      {
        time: new Date(order.createdAt || Date.now()).toLocaleString('vi-VN'),
        text: 'Đơn hàng đã được tạo trên backend marketplace.',
        tone: 'success',
      },
    ],
  };
};

const mapBackendOrderTreeToShared = (order: BackendOrderTreeResponse): SharedOrder => {
  const customerName = order.shippingAddress?.fullName || order.customer?.name || 'KhÃ¡ch hÃ ng';
  const subOrders = order.subOrders || [];
  const rootItems = order.items || [];

  const normalizedItems = subOrders.length > 0
    ? subOrders.flatMap((subOrder) =>
      (subOrder.items || []).map((item, itemIndex) => ({
        id: item.id || `${subOrder.id || order.id}-${itemIndex + 1}`,
        name: item.name || `Item ${itemIndex + 1}`,
        price: Number(item.unitPrice || item.totalPrice || 0),
        image: item.image || '',
        quantity: item.quantity || 0,
        size: item.variant || '',
        storeId: subOrder.vendorId,
        storeName: subOrder.vendorName,
      })),
    )
    : rootItems.map((item, itemIndex) => ({
      id: item.id || `${order.id}-${itemIndex + 1}`,
      name: item.name || `Item ${itemIndex + 1}`,
      price: Number(item.unitPrice || item.totalPrice || 0),
      image: item.image || '',
      quantity: item.quantity || 0,
      size: item.variant || '',
      storeId: undefined,
      storeName: undefined,
    }));

  const firstTracking = subOrders.find((subOrder) => Boolean(subOrder.trackingNumber))?.trackingNumber || '';
  const delayNotes = subOrders
    .map((subOrder) => subOrder.warehouseNote || '')
    .filter((value) => Boolean(value && value.trim()));

  return {
    id: order.id,
    code: order.code || order.id,
    createdAt: order.createdAt || new Date().toISOString(),
    customerName,
    customerEmail: order.customer?.email || '',
    customerPhone: order.shippingAddress?.phone || order.customer?.phone || '',
    customerAvatar: 'KH',
    address: formatBackendAddress(order.shippingAddress),
    shipMethod: 'Marketplace delivery',
    tracking: firstTracking,
    note: delayNotes.length > 0 ? delayNotes.join(' | ') : '',
    paymentMethod: order.paymentMethod || 'COD',
    paymentStatus: backendPaymentStatusToClient(order.paymentStatus, order.paymentMethod),
    fulfillment: clientStatusToFulfillment(backendStatusToClientStatus(order.status)),
    items: normalizedItems,
    subtotal: Number(order.subtotal || 0),
    shippingFee: Number(order.shippingFee || 0),
    discount: Number(order.discount || 0),
    total: Number(order.totalAmount || 0),
    timeline: [
      {
        time: new Date(order.createdAt || Date.now()).toLocaleString('vi-VN'),
        text: 'ÄÆ¡n hÃ ng Ä‘Ã£ Ä‘Æ°á»£c táº¡o.',
        tone: 'success',
      },
      ...subOrders.map((subOrder) => ({
        time: new Date(subOrder.createdAt || order.createdAt || Date.now()).toLocaleString('vi-VN'),
        text: `${subOrder.vendorName || 'Vendor'} - ${subOrder.status || 'PENDING'}`,
        tone: 'neutral' as const,
      })),
    ],
  };
};

const syncBackendOrderToSharedStore = (order: SharedOrder) => {
  const shared = order;
  sharedOrderStore.upsert(shared);
};

const toClientOrder = (o: SharedOrder): Order => ({
  id: o.id,
  code: o.code || o.id,
  createdAt: o.createdAt,
  status: fulfillmentToClientStatus(o.fulfillment, o.paymentStatus) as OrderStatus,
  total: o.total,
  items: o.items.map((item): OrderItem => ({
    id: item.id,
    name: item.name,
    price: item.price,
    originalPrice: item.originalPrice,
    image: item.image,
    quantity: item.quantity,
    color: item.color,
    size: item.size,
  })),
  addressSummary: `${o.customerName}, ${o.customerPhone}, ${o.address}`,
  paymentMethod: o.paymentMethod,
  statusSteps: o.timeline.map((t): OrderStatusStep => ({
    label: t.text,
    timestamp: t.time,
  })),
  cancelReason: o.cancelReason,
  cancelledAt: o.cancelledAt,
  tracking: o.tracking,
  shippingFee: o.shippingFee,
  discount: o.discount,
  // Multi-vendor fields
  parentOrderId: o.parentOrderId,
  storeId: o.storeId,
  storeName: o.storeName,
});


export const orderService = {
  isBackendReadyItemId(id: string): boolean {
    return UUID_PATTERN.test(id);
  },

  async createBackendOrder(input: {
    addressId: string;
    paymentMethod: string;
    couponCode?: string;
    note?: string;
    items: BackendOrderRequestItem[];
  }) {
    const order = await apiRequest<BackendOrderResponse>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(input),
    }, { auth: true });
    syncBackendOrderToSharedStore(mapBackendOrderToShared(order));
    return order;
  },

  async listFromBackend(): Promise<Order[]> {
    const orders = await apiRequest<BackendOrderResponse[]>('/api/orders', {}, { auth: true });
    const mapped = (orders || []).map(mapBackendOrderToShared);
    sharedOrderStore.replaceAll(mapped);
    return mapped.map(toClientOrder);
  },

  async getByIdFromBackend(id: string): Promise<Order | null> {
    try {
      const normalizedId = String(id || '').trim();
      if (!normalizedId) {
        return null;
      }
      if (!UUID_PATTERN.test(normalizedId) && !ORDER_CODE_PATTERN.test(normalizedId)) {
        return null;
      }

      const path = UUID_PATTERN.test(normalizedId)
        ? `/api/orders/${normalizedId}/tree`
        : `/api/orders/code/${encodeURIComponent(normalizedId)}/tree`;
      const order = await apiRequest<BackendOrderTreeResponse>(path, {}, { auth: true });
      const mapped = mapBackendOrderTreeToShared(order);
      syncBackendOrderToSharedStore(mapped);
      return toClientOrder(mapped);
    } catch (error: unknown) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async cancelOnBackend(id: string, reason: string): Promise<Order | null> {
    if (!UUID_PATTERN.test(id)) {
      throw new Error('Mã đơn hàng không hợp lệ.');
    }

    const updated = await apiRequest<BackendOrderResponse>(`/api/orders/${id}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    }, { auth: true });
    const mapped = mapBackendOrderToShared(updated);
    syncBackendOrderToSharedStore(mapped);
    return toClientOrder(mapped);
  },
};
