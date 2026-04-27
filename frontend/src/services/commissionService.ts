import { apiRequest } from './apiClient';

export interface CommissionTier {
  id: string;
  name: string;
  slug: string;
  description: string;
  rate: number;
  minMonthlyRevenue?: number;
  minOrderCount?: number;
  isDefault?: boolean;
  isActive?: boolean;
  sortOrder?: number;
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

export const commissionService = {
  async getTiers(): Promise<CommissionTier[]> {
    return apiRequest<CommissionTier[]>('/api/commission-tiers', {}, { auth: false });
  },

  async getDefaultTier(): Promise<CommissionTier> {
    return apiRequest<CommissionTier>('/api/commission-tiers/default', {}, { auth: false });
  },

  async determineTier(monthlyRevenue: number, orderCount: number): Promise<CommissionTier> {
    const tiers = await this.getTiers();
    const eligible = tiers
      .filter((tier) => {
        const meetsRevenue = !tier.minMonthlyRevenue || monthlyRevenue >= tier.minMonthlyRevenue;
        const meetsOrders = !tier.minOrderCount || orderCount >= tier.minOrderCount;
        return meetsRevenue && meetsOrders && tier.isActive;
      })
      .sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0));

    return eligible[0] || await this.getDefaultTier();
  },

  formatRate(rate: number): string {
    return `${rate}%`;
  },

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  },

  async createTier(tier: Omit<CommissionTier, 'id' | 'slug'>): Promise<CommissionTier> {
    return apiRequest<CommissionTier>('/api/commission-tiers', {
      method: 'POST',
      body: JSON.stringify(tier),
    }, { auth: true });
  },

  async updateTier(tierId: string, updates: Partial<CommissionTier>): Promise<CommissionTier> {
    return apiRequest<CommissionTier>(`/api/commission-tiers/${tierId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    }, { auth: true });
  },

  async setDefaultTier(tierId: string): Promise<void> {
    await apiRequest(`/api/commission-tiers/${tierId}/default`, {
      method: 'PATCH',
    }, { auth: true });
  },

  async toggleTierActive(tierId: string): Promise<void> {
    await apiRequest(`/api/commission-tiers/${tierId}/toggle-active`, {
      method: 'PATCH',
    }, { auth: true });
  },

  async deleteTier(tierId: string): Promise<void> {
    await apiRequest(`/api/commission-tiers/${tierId}`, {
      method: 'DELETE',
    }, { auth: true });
  },
};
