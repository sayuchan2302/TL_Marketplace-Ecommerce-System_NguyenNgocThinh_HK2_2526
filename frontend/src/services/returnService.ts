import { apiRequest } from './apiClient';

export type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type ReturnReason = 'SIZE' | 'DEFECT' | 'CHANGE' | 'OTHER';
export type ReturnResolution = 'EXCHANGE' | 'REFUND';

export interface ReturnItem {
  orderItemId: string;
  productName: string;
  variantName?: string;
  imageUrl?: string;
  quantity: number;
  unitPrice: number;
}

export interface ReturnRequest {
  id: string;
  code?: string;
  orderId: string;
  orderCode?: string;
  userId: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  reason: ReturnReason;
  note?: string;
  resolution: ReturnResolution;
  status: ReturnStatus;
  items: ReturnItem[];
  storeId?: string;
  storeName?: string;
  adminNote?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReturnSubmitPayload {
  orderId: string;
  reason: ReturnReason;
  note?: string;
  resolution: ReturnResolution;
  items: Array<{ orderItemId: string; quantity?: number }>;
}

export interface ReturnListResponse {
  content: ReturnRequest[];
  totalElements: number;
  totalPages: number;
  number: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const returnService = {
  async submit(payload: ReturnSubmitPayload): Promise<ReturnRequest> {
    return apiRequest<ReturnRequest>('/api/returns', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, { auth: true });
  },

  async listAdmin(params: { status?: ReturnStatus; page?: number; size?: number } = {}): Promise<ReturnListResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    if (params.page !== undefined) query.set('page', String(params.page));
    if (params.size !== undefined) query.set('size', String(params.size));
    const qs = query.toString();
    return apiRequest<ReturnListResponse>(`/api/returns${qs ? `?${qs}` : ''}`, {}, { auth: true });
  },

  async getAdminByIdentifier(identifier: string): Promise<ReturnRequest> {
    const normalized = String(identifier || '').trim();
    const path = UUID_PATTERN.test(normalized)
      ? `/api/returns/${normalized}`
      : `/api/returns/code/${encodeURIComponent(normalized)}`;
    return apiRequest<ReturnRequest>(path, {}, { auth: true });
  },

  // Backward compatible alias.
  async getAdmin(id: string): Promise<ReturnRequest> {
    return this.getAdminByIdentifier(id);
  },

  async updateStatus(id: string, status: ReturnStatus, adminNote?: string): Promise<ReturnRequest> {
    return apiRequest<ReturnRequest>(`/api/returns/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNote }),
    }, { auth: true });
  },
};
