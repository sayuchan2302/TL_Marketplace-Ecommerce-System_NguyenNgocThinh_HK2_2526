import { apiRequest } from './apiClient';

type UserRole = 'CUSTOMER' | 'VENDOR' | 'SUPER_ADMIN';
type UserGender = 'MALE' | 'FEMALE' | 'OTHER';

interface BackendProfileResponse {
  id: string;
  name?: string | null;
  email: string;
  phone?: string | null;
  avatar?: string | null;
  gender?: UserGender | null;
  dateOfBirth?: string | null;
  height?: number | null;
  weight?: number | null;
  loyaltyPoints?: number | null;
  role?: UserRole;
  storeId?: string | null;
}

export interface UserProfileRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  gender: UserGender;
  dateOfBirth: string | null;
  height: number | null;
  weight: number | null;
  loyaltyPoints: number;
  role?: UserRole;
  storeId?: string;
}

export interface UpdateUserProfilePayload {
  name?: string;
  phone?: string;
  gender?: UserGender;
  dateOfBirth?: string | null;
  height?: number | null;
  weight?: number | null;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

const mapProfile = (payload: BackendProfileResponse): UserProfileRecord => ({
  id: payload.id,
  name: payload.name?.trim() || '',
  email: payload.email?.trim() || '',
  phone: payload.phone?.trim() || '',
  avatar: payload.avatar?.trim() || undefined,
  gender: payload.gender || 'OTHER',
  dateOfBirth: payload.dateOfBirth || null,
  height: typeof payload.height === 'number' ? payload.height : null,
  weight: typeof payload.weight === 'number' ? payload.weight : null,
  loyaltyPoints: typeof payload.loyaltyPoints === 'number' ? payload.loyaltyPoints : 0,
  role: payload.role,
  storeId: payload.storeId || undefined,
});

export const profileService = {
  async getMyProfile(): Promise<UserProfileRecord> {
    const response = await apiRequest<BackendProfileResponse>('/api/users/me', { method: 'GET' }, { auth: true });
    return mapProfile(response);
  },

  async updateMyProfile(payload: UpdateUserProfilePayload): Promise<UserProfileRecord> {
    const response = await apiRequest<BackendProfileResponse>('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, { auth: true });
    return mapProfile(response);
  },

  async changePassword(payload: ChangePasswordPayload): Promise<void> {
    await apiRequest<void>('/api/users/me/password', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, { auth: true });
  },
};
