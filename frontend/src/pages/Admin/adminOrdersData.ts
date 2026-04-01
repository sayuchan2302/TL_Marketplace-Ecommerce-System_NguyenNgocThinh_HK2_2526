import type { FulfillmentStatus, PaymentStatus } from './orderWorkflow';

export interface AdminOrderItem {
  id: number;
  name: string;
  color: string;
  size: string;
  qty: number;
  price: number;
  image: string;
}

export interface AdminOrderPricing {
  subtotal: number;
  shipping: number;
  discount: number;
  voucher: string;
}

export interface AdminOrderTimelineEntry {
  time: string;
  text: string;
  tone: 'success' | 'pending' | 'error' | 'neutral' | 'info';
}

export interface AdminOrderData {
  id?: string;
  code: string;
  customer: string;
  avatar: string;
  total: string;
  storeName?: string;
  commissionRate?: number;
  commissionFee?: number;
  vendorPayout?: number;
  paymentStatus: PaymentStatus;
  fulfillment: FulfillmentStatus;
  shipMethod: string;
  tracking: string;
  date: string;
  customerInfo: {
    name: string;
    phone: string;
    email: string;
  };
  address: string;
  note: string;
  paymentMethod: string;
  items: AdminOrderItem[];
  pricing: AdminOrderPricing;
  timeline: AdminOrderTimelineEntry[];
}
