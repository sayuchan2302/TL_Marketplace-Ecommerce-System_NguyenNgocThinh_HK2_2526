import type { Address } from '../types';
import { apiRequest } from './apiClient';

const KEY = 'coolmate_addresses_v1';

interface BackendAddressResponse {
  id: string;
  fullName?: string | null;
  phone?: string | null;
  province?: string | null;
  district?: string | null;
  ward?: string | null;
  detail?: string | null;
  isDefault?: boolean | null;
}

type AddressPayload = Omit<Address, 'id'>;

const load = (): Address[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const save = (data: Address[]) => {
  localStorage.setItem(KEY, JSON.stringify(data));
};

const mapBackendAddress = (address: BackendAddressResponse): Address => ({
  id: address.id,
  fullName: address.fullName?.trim() || '',
  phone: address.phone?.trim() || '',
  detail: address.detail?.trim() || '',
  ward: address.ward?.trim() || '',
  district: address.district?.trim() || '',
  province: address.province?.trim() || '',
  isDefault: Boolean(address.isDefault),
});

export const addressService = {
  async listFromBackend(): Promise<Address[]> {
    const rows = await apiRequest<BackendAddressResponse[]>('/api/addresses', { method: 'GET' }, { auth: true });
    return Array.isArray(rows) ? rows.map(mapBackendAddress) : [];
  },

  async addOnBackend(address: AddressPayload): Promise<Address> {
    const created = await apiRequest<BackendAddressResponse>('/api/addresses', {
      method: 'POST',
      body: JSON.stringify(address),
    }, { auth: true });
    return mapBackendAddress(created);
  },

  async updateOnBackend(id: string, payload: Partial<AddressPayload>): Promise<Address> {
    const updated = await apiRequest<BackendAddressResponse>(`/api/addresses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }, { auth: true });
    return mapBackendAddress(updated);
  },

  async removeOnBackend(id: string): Promise<void> {
    await apiRequest<void>(`/api/addresses/${id}`, { method: 'DELETE' }, { auth: true });
  },

  async setDefaultOnBackend(id: string): Promise<Address> {
    const updated = await apiRequest<BackendAddressResponse>(`/api/addresses/${id}/default`, {
      method: 'PATCH',
    }, { auth: true });
    return mapBackendAddress(updated);
  },

  getAll(): Address[] {
    const data = load();
    if (data.length === 0) {
      const seed: Address[] = [
        {
          id: 'addr-1',
          fullName: 'Anh Thịnh',
          phone: '0382253049',
          detail: 'JJJV+Q7F, Quốc lộ 37',
          ward: 'Thị trấn Hùng Sơn',
          district: 'Huyện Đại Từ',
          province: 'Thái Nguyên',
          isDefault: true,
        },
      ];
      save(seed);
      return seed;
    }
    return data.map(addr => ({ ...addr, isDefault: Boolean(addr.isDefault) }));
  },

  formatFullAddress(addr: Address): string {
    return `${addr.detail}, ${addr.ward}, ${addr.district}, ${addr.province}`;
  },

  add(address: Omit<Address, 'id'>): Address {
    const data = this.getAll();
    const isDefault = Boolean(address.isDefault);
    const newAddr: Address = { ...address, id: 'addr-' + Date.now(), isDefault };
    const next = isDefault
      ? data.map(a => ({ ...a, isDefault: false })).concat(newAddr)
      : [...data, newAddr];
    save(next);
    return newAddr;
  },

  update(id: string, payload: Partial<Address>): Address | null {
    const data = this.getAll();
    let updated: Address | null = null;
    const next = data.map(addr => {
      if (addr.id !== id) return addr;
      updated = { ...addr, ...payload, id };
      return updated;
    });
    if (!updated) return null;
    if (payload.isDefault) {
      for (const addr of next) {
        if (addr.id !== id) addr.isDefault = false;
      }
    }
    save(next);
    return updated;
  },

  remove(id: string) {
    const data = this.getAll();
    const next = data.filter(a => a.id !== id);
    // ensure one default remains
    if (!next.some(a => a.isDefault) && next.length > 0) {
      next[0].isDefault = true;
    }
    save(next);
  },

  setDefault(id: string) {
    const data = this.getAll().map(a => ({ ...a, isDefault: a.id === id }));
    save(data);
  },
};
