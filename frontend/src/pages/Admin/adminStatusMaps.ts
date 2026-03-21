export type ProductStatusType = 'active' | 'low' | 'out';

export const productStatusTone = (type: ProductStatusType | string) => {
  if (type === 'low') return 'warning';
  if (type === 'out') return 'neutral';
  return 'success';
};

export type PromotionStatus = 'running' | 'expired' | 'paused';

export const promotionStatusLabel = (status: PromotionStatus) => {
  const labels: Record<PromotionStatus, string> = {
    running: 'Đang chạy',
    paused: 'Tạm dừng',
    expired: 'Hết hạn',
  };
  return labels[status];
};

export const promotionStatusClass = (status: PromotionStatus) => {
  if (status === 'running') return 'promo-status-running';
  if (status === 'paused') return 'promo-status-paused';
  return 'promo-status-expired';
};

export type CustomerOrderStatus = 'pending' | 'shipping' | 'done' | 'canceled';

export const customerOrderStatusTone = (status: CustomerOrderStatus) => {
  if (status === 'done') return 'success';
  if (status === 'shipping' || status === 'pending') return 'pending';
  return 'error';
};

export const customerOrderStatusLabel = (status: CustomerOrderStatus) => {
  const labels: Record<CustomerOrderStatus, string> = {
    pending: 'Chờ xác nhận',
    shipping: 'Đang giao',
    done: 'Hoàn tất',
    canceled: 'Đã hủy',
  };
  return labels[status];
};
