export type FulfillmentStatus = 'pending' | 'packing' | 'shipping' | 'done' | 'canceled';

export type PaymentStatus = 'paid' | 'unpaid' | 'cod_uncollected' | 'refund_pending' | 'refunded';

export type TransitionReasonCode =
  | 'customer_request'
  | 'payment_timeout'
  | 'out_of_stock'
  | 'fraud_risk'
  | 'delivered_confirmed'
  | 'cod_collected_manual'
  | 'system_reconciliation'
  | 'other';

export interface TransitionReasonOption {
  code: TransitionReasonCode;
  label: string;
  requireNote?: boolean;
}

export const transitionReasonCatalog: Record<FulfillmentStatus, TransitionReasonOption[]> = {
  pending: [],
  packing: [],
  shipping: [],
  done: [
    { code: 'delivered_confirmed', label: 'Khách xác nhận đã nhận hàng' },
    { code: 'cod_collected_manual', label: 'Đối soát COD đã thu thủ công' },
    { code: 'system_reconciliation', label: 'Đối soát vận đơn tự động' },
    { code: 'other', label: 'Lý do khác', requireNote: true },
  ],
  canceled: [
    { code: 'customer_request', label: 'Khách yêu cầu hủy đơn' },
    { code: 'payment_timeout', label: 'Quá hạn thanh toán' },
    { code: 'out_of_stock', label: 'Hết hàng tại kho' },
    { code: 'fraud_risk', label: 'Nghi ngờ gian lận', requireNote: true },
    { code: 'other', label: 'Lý do khác', requireNote: true },
  ],
};

export const fulfillmentTransitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
  pending: ['packing', 'canceled'],
  packing: ['shipping', 'canceled'],
  shipping: ['done'],
  done: [],
  canceled: [],
};

export const fulfillmentLabel = (state: FulfillmentStatus) => {
  const statusMap: Record<FulfillmentStatus, string> = {
    pending: 'Chờ xác nhận',
    packing: 'Đang đóng gói',
    shipping: 'Đang giao',
    done: 'Hoàn tất',
    canceled: 'Đã hủy',
  };
  return statusMap[state];
};

export const shipLabel = (state: FulfillmentStatus) => {
  const statusMap: Record<FulfillmentStatus, string> = {
    pending: 'Chờ xác nhận',
    packing: 'Đang đóng gói',
    shipping: 'Đang giao',
    done: 'Đã giao',
    canceled: 'Đã hủy',
  };
  return statusMap[state];
};

export const paymentLabel = (state: PaymentStatus) => {
  if (state === 'paid') return 'Đã thanh toán';
  if (state === 'unpaid') return 'Chưa thanh toán';
  if (state === 'cod_uncollected') return 'COD chưa thu';
  if (state === 'refund_pending') return 'Đang hoàn tiền';
  return 'Đã hoàn tiền';
};

export const transitionReasonLabel = (code: TransitionReasonCode) => {
  const all = Object.values(transitionReasonCatalog).flat();
  return all.find((item) => item.code === code)?.label || code;
};

export const canTransitionFulfillment = (
  current: FulfillmentStatus,
  next: FulfillmentStatus,
  paymentStatus: PaymentStatus,
) => {
  if (current === next) return true;
  if (!fulfillmentTransitions[current].includes(next)) return false;
  if (next === 'done' && paymentStatus !== 'paid' && paymentStatus !== 'cod_uncollected') return false;
  return true;
};

export const validateTransitionReason = (
  next: FulfillmentStatus,
  reasonCode?: TransitionReasonCode,
  reasonNote?: string,
) => {
  const options = transitionReasonCatalog[next] || [];
  if (options.length === 0) return { ok: true as const };
  const selected = options.find((item) => item.code === reasonCode);
  if (!selected) {
    return { ok: false as const, error: 'Vui lòng chọn lý do trước khi cập nhật trạng thái.' };
  }
  if (selected.requireNote && !(reasonNote || '').trim()) {
    return { ok: false as const, error: 'Lý do này yêu cầu nhập ghi chú chi tiết.' };
  }
  return { ok: true as const, selected };
};
