import { apiRequest, hasBackendJwt } from './apiClient';
import { authService } from './authService';

export type ReviewStatus = 'pending' | 'approved' | 'hidden';

export interface Review {
  id: string;
  storeId: string;
  productId: string;
  productName: string;
  productImage: string;
  orderId: string;
  orderCode?: string;
  rating: number;
  title?: string;
  content: string;
  images?: string[];
  createdAt: string;
  updatedAt?: string;
  helpful: number;
  shopReply?: {
    content: string;
    createdAt: string;
  };
  status: ReviewStatus;
  version: number;
}

export interface EligibleReviewItem {
  orderId: string;
  orderCode?: string;
  productId: string;
  productName: string;
  productImage: string;
  variantName?: string;
  quantity: number;
  deliveredAt?: string;
}

export interface ReviewSubmission {
  storeId?: string;
  productId: string;
  productName?: string;
  productImage?: string;
  orderId?: string;
  rating: number;
  title?: string;
  content: string;
  images?: string[];
}

interface BackendReviewResponse {
  id: string;
  storeId?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  rating?: number;
  content?: string;
  images?: string[];
  date?: string;
  status?: string;
  reply?: string | null;
  replyAt?: string | null;
  orderId?: string;
  orderCode?: string;
  version?: number;
}

interface BackendEligibleReviewItem {
  orderId?: string;
  orderCode?: string;
  productId?: string;
  productName?: string;
  productImage?: string;
  variantName?: string;
  quantity?: number;
  deliveredAt?: string;
}

interface BackendPage<T> {
  content?: T[];
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const sortByNewest = (rows: Review[]) =>
  [...rows].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());

const normalizeStatus = (status?: string): ReviewStatus => {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'APPROVED') return 'approved';
  if (normalized === 'HIDDEN' || normalized === 'REJECTED') return 'hidden';
  return 'pending';
};

const mapBackendReview = (row: BackendReviewResponse): Review => {
  const createdAt = row.date || new Date().toISOString();
  return {
    id: String(row.id),
    storeId: row.storeId || '',
    productId: row.productId || '',
    productName: row.productName || 'Sản phẩm',
    productImage: row.productImage || '',
    orderId: row.orderId || '',
    orderCode: row.orderCode || undefined,
    rating: Number(row.rating || 0),
    title: undefined,
    content: row.content || '',
    images: row.images || [],
    createdAt,
    updatedAt: createdAt,
    helpful: 0,
    shopReply: row.reply
      ? {
          content: row.reply,
          createdAt: row.replyAt || createdAt,
        }
      : undefined,
    status: normalizeStatus(row.status),
    version: Number(row.version || 0),
  };
};

const mapBackendEligibleReview = (row: BackendEligibleReviewItem): EligibleReviewItem => ({
  orderId: String(row.orderId || ''),
  orderCode: row.orderCode || undefined,
  productId: String(row.productId || ''),
  productName: row.productName || 'Sản phẩm',
  productImage: row.productImage || '',
  variantName: row.variantName || '',
  quantity: Number(row.quantity || 0),
  deliveredAt: row.deliveredAt,
});

export const reviewService = {
  async getReviews(): Promise<Review[]> {
    if (!hasBackendJwt()) return [];
    const rows = await apiRequest<BackendReviewResponse[]>('/api/reviews/my', {}, { auth: true });
    return sortByNewest((rows || []).map(mapBackendReview));
  },

  async getReviewsByStore(storeId: string): Promise<Review[]> {
    const rows = await apiRequest<BackendReviewResponse[]>(`/api/reviews/store/${storeId}`);
    return sortByNewest((rows || []).map(mapBackendReview));
  },

  async getEligibleReviews(): Promise<EligibleReviewItem[]> {
    if (!hasBackendJwt()) return [];
    const rows = await apiRequest<BackendEligibleReviewItem[]>(
      '/api/reviews/my/eligible',
      {},
      { auth: true },
    );
    return (rows || [])
      .map(mapBackendEligibleReview)
      .filter((item) => Boolean(item.orderId && item.productId));
  },

  async getVendorReviews(params: { status?: ReviewStatus | 'all'; page?: number; size?: number } = {}): Promise<Review[]> {
    const query = new URLSearchParams();
    query.set('page', String(Math.max(0, (params.page ?? 1) - 1)));
    query.set('size', String(Math.max(1, params.size ?? 1000)));
    if (params.status && params.status !== 'all') {
      query.set('status', params.status.toUpperCase());
    }

    const response = await apiRequest<BackendPage<BackendReviewResponse>>(
      `/api/reviews/my-store?${query.toString()}`,
      {},
      { auth: true },
    );

    return (response.content || []).map(mapBackendReview);
  },

  async replyAsVendor(id: string, reply: string): Promise<Review> {
    const response = await apiRequest<BackendReviewResponse>(
      `/api/reviews/my-store/${id}/reply`,
      {
        method: 'POST',
        body: JSON.stringify({ reply }),
      },
      { auth: true },
    );
    return mapBackendReview(response);
  },

  async getReviewsByOrder(orderId: string): Promise<Review[]> {
    if (!hasBackendJwt()) return [];
    const rows = await apiRequest<BackendReviewResponse[]>(
      `/api/reviews/my?orderId=${encodeURIComponent(orderId)}`,
      {},
      { auth: true },
    );
    return sortByNewest((rows || []).map(mapBackendReview));
  },

  async getReviewsByProduct(productId: string): Promise<Review[]> {
    const normalizedProductId = String(productId || '').trim();
    if (!UUID_PATTERN.test(normalizedProductId)) return [];
    const rows = await apiRequest<BackendReviewResponse[]>(
      `/api/reviews/product/${encodeURIComponent(normalizedProductId)}`,
    );
    return sortByNewest((rows || []).map(mapBackendReview));
  },

  async getAverageRating(productId: string): Promise<number> {
    const reviews = await this.getReviewsByProduct(productId);
    if (reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  },

  async submitReview(submission: ReviewSubmission): Promise<Review> {
    const normalizedProductId = String(submission.productId || '').trim();
    if (!UUID_PATTERN.test(normalizedProductId)) {
      throw new Error('Sản phẩm chưa đồng bộ với backend, vui lòng tải lại trang.');
    }

    const payload: {
      productId: string;
      orderId?: string;
      rating: number;
      title?: string;
      content: string;
      images?: string[];
    } = {
      productId: normalizedProductId,
      rating: submission.rating,
      title: submission.title,
      content: submission.content,
      images: submission.images,
    };

    if (submission.orderId && submission.orderId.trim()) {
      const normalizedOrderId = submission.orderId.trim();
      if (!UUID_PATTERN.test(normalizedOrderId)) {
        throw new Error('Đơn hàng chưa đồng bộ với backend, vui lòng tải lại trang.');
      }
      payload.orderId = normalizedOrderId;
    }

    const response = await apiRequest<BackendReviewResponse>(
      '/api/reviews',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      { auth: true },
    );
    return mapBackendReview(response);
  },

  async hasReviewed(productId: string, orderId: string): Promise<boolean> {
    if (!hasBackendJwt()) return false;
    const rows = await apiRequest<BackendReviewResponse[]>(
      `/api/reviews/my?productId=${encodeURIComponent(productId)}&orderId=${encodeURIComponent(orderId)}`,
      {},
      { auth: true },
    );
    return (rows || []).length > 0;
  },

  canVendorReply(): boolean {
    if (!hasBackendJwt()) {
      return false;
    }
    const session = authService.getSession() || authService.getAdminSession();
    return session?.user.role === 'VENDOR';
  },
};
