import { apiRequest } from './apiClient';

export type AdminUserRole = 'CUSTOMER' | 'VENDOR' | 'SUPER_ADMIN';
export type AdminUserStatus = 'ACTIVE' | 'LOCKED' | 'PENDING_VENDOR';
export type AdminUserGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface AdminUserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  gender?: AdminUserGender;
  dateOfBirth?: string;
  height?: number;
  weight?: number;
  loyaltyPoints?: number;
  role: AdminUserRole;
  status: AdminUserStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  storeApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  storeStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export const adminUserService = {
  async list(params: { q?: string; role?: AdminUserRole; status?: AdminUserStatus } = {}): Promise<AdminUserRecord[]> {
    const query = new URLSearchParams();
    if (params.q) query.set('q', params.q);
    if (params.role) query.set('role', params.role);
    if (params.status) query.set('status', params.status);
    const qs = query.toString();
    return apiRequest<AdminUserRecord[]>(`/api/admin/users${qs ? `?${qs}` : ''}`, {}, { auth: true });
  },

  async updateActive(userId: string, active: boolean): Promise<AdminUserRecord> {
    return apiRequest<AdminUserRecord>(`/api/admin/users/${userId}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    }, { auth: true });
  },
};
