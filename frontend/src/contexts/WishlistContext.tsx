/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, type ReactNode } from 'react';
import { useToast } from './ToastContext';
import { authService } from '../services/authService';

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
}

interface WishlistContextType {
  items: WishlistItem[];
  addToWishlist: (item: WishlistItem) => void;
  removeFromWishlist: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  totalItems: number;
}

const WishlistContext = createContext<WishlistContextType | undefined>(undefined);

const buildLoginRedirectTarget = () => {
  if (typeof window === 'undefined') return '/login';
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?reason=${encodeURIComponent('auth-required')}&redirect=${encodeURIComponent(current)}`;
};

export const WishlistProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const { addToast } = useToast();

  const ensureAuthenticated = () => {
    const session = authService.getSession() || authService.getAdminSession();
    const token = session?.token;
    const isValid = Boolean(
      token
      && authService.isBackendJwtToken(token)
      && !authService.isJwtExpired(token),
    );

    if (isValid) return true;

    addToast('Vui lòng đăng nhập để dùng danh sách yêu thích.', 'info');
    if (typeof window !== 'undefined') {
      window.location.href = buildLoginRedirectTarget();
    }
    return false;
  };

  const addToWishlist = (item: WishlistItem) => {
    if (!ensureAuthenticated()) {
      return;
    }

    const existing = items.find(i => i.id === item.id);
    if (!existing) {
      setItems(prev => [...prev, item]);
      addToast('Đã thêm vào danh sách yêu thích', 'add');
    }
  };

  const removeFromWishlist = (id: string) => {
    const existing = items.find(i => i.id === id);
    if (existing) {
      setItems(prev => prev.filter(item => item.id !== id));
      addToast('Đã xoá khỏi danh sách yêu thích', 'remove');
    }
  };

  const isInWishlist = (id: string) => items.some(i => i.id === id);

  return (
    <WishlistContext.Provider value={{ items, addToWishlist, removeFromWishlist, isInWishlist, totalItems: items.length }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
};
