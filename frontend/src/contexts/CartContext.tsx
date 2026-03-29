/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useToast } from './ToastContext';
import { authService } from '../services/authService';

// ─── Types ────────────────────────────────────────────────────────────────────
export type CartItem = {
  cartId: string;     // unique key = `${productId}-${color}-${size}`
  id: number | string;
  backendProductId?: string;
  backendVariantId?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  color: string;
  size: string;
  quantity: number;
  // Multi-vendor fields (optional for backward compatibility)
  storeId?: string;
  storeName?: string;
  isOfficialStore?: boolean;
}

export type StoreGroup = {
  storeId: string;
  storeName: string;
  isOfficialStore: boolean;
  items: CartItem[];
  subtotal: number;
  shippingFee: number;
}

interface CartContextValue {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'cartId' | 'quantity'> & { quantity?: number }) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  groupedByStore: () => StoreGroup[];
}

// ─── Context ──────────────────────────────────────────────────────────────────
const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'coolmate_cart_v1';
const FREE_SHIPPING_THRESHOLD = 500000;
const DEFAULT_SHIPPING_FEE = 30000;

const buildLoginRedirectTarget = () => {
  if (typeof window === 'undefined') return '/login';
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?reason=${encodeURIComponent('auth-required')}&redirect=${encodeURIComponent(current)}`;
};

// ─── Grouping Logic ────────────────────────────────────────────────────────────
const groupByStore = (items: CartItem[]): StoreGroup[] => {
  const groups = items.reduce((acc, item) => {
    const storeId = item.storeId || 'default-store';
    const storeName = item.storeName || 'Cửa hàng';
    
    if (!acc[storeId]) {
      acc[storeId] = {
        storeId,
        storeName,
        isOfficialStore: item.isOfficialStore || false,
        items: [],
        subtotal: 0,
        shippingFee: DEFAULT_SHIPPING_FEE,
      };
    }
    acc[storeId].items.push(item);
    acc[storeId].subtotal += item.price * item.quantity;
    return acc;
  }, {} as Record<string, StoreGroup>);

  // Calculate shipping fee for each store
  Object.values(groups).forEach(group => {
    group.shippingFee = group.subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE;
  });

  return Object.values(groups);
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
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

    addToast('Vui lòng đăng nhập để thêm sản phẩm vào giỏ hàng.', 'info');
    if (typeof window !== 'undefined') {
      window.location.href = buildLoginRedirectTarget();
    }
    return false;
  };

  // Persist to localStorage whenever cart changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addToCart = (
    newItem: Omit<CartItem, 'cartId' | 'quantity'> & { quantity?: number }
  ) => {
    if (!ensureAuthenticated()) {
      return;
    }

    const cartId = `${newItem.id}-${newItem.color}-${newItem.size}`;
    const qty = newItem.quantity ?? 1;

    const existing = items.find(i => i.cartId === cartId);
    if (existing) {
      setItems(prev => prev.map(i =>
        i.cartId === cartId
          ? { ...i, quantity: Math.min(i.quantity + qty, 10) }
          : i
      ));
      addToast(`Đã cập nhật số lượng của ${newItem.name} trong giỏ hàng`, 'info');
    } else {
      setItems(prev => [...prev, { ...newItem, cartId, quantity: qty }]);
      addToast(`Đã thêm ${newItem.name} vào giỏ hàng`, 'add');
    }
  };

  const removeFromCart = (cartId: string) => {
    const existing = items.find(i => i.cartId === cartId);
    if (existing) {
      setItems(prev => prev.filter(i => i.cartId !== cartId));
      addToast('Đã xoá sản phẩm khỏi giỏ', 'remove');
    }
  };

  const updateQuantity = (cartId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(cartId);
    } else {
      setItems(prev =>
        prev.map(i => (i.cartId === cartId ? { ...i, quantity } : i))
      );
    }
  };

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const groupedByStore = () => groupByStore(items);

  return (
    <CartContext.Provider
      value={{ 
        items, 
        addToCart, 
        removeFromCart, 
        updateQuantity, 
        clearCart, 
        totalItems, 
        totalPrice,
        groupedByStore,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────
export const useCart = (): CartContextValue => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};
