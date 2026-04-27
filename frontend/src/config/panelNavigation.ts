import type { PanelNavItem } from '../pages/Admin/AdminLayout';

export const adminPanelNav: PanelNavItem[] = [
  { label: 'Dashboard', to: '/admin/dashboard', exact: true },
  { label: 'Danh mục', to: '/admin/categories' },
  { label: 'Quản lý sản phẩm', to: '/admin/product-governance' },
  { label: 'Gian hàng', to: '/admin/stores' },
  { label: 'Khách hàng', to: '/admin/users' },
  { label: 'Đơn hàng', to: '/admin/orders' },
  { label: 'Hoàn đơn', to: '/admin/returns' },
  { label: 'Đánh giá', to: '/admin/reviews' },
  { label: 'Tài chính', to: '/admin/financials' },
  { label: 'Voucher toàn sàn', to: '/admin/promotions' },
  { label: 'Bot và AI', to: '/admin/bot-ai' },
];

export const vendorPanelNav: PanelNavItem[] = [
  { label: 'Dashboard', to: '/vendor/dashboard', exact: true },
  { label: 'Gian hàng', to: '/vendor/storefront' },
  { label: 'Sản phẩm', to: '/vendor/products' },
  { label: 'Đơn hàng', to: '/vendor/orders' },
  { label: 'Hoàn trả', to: '/vendor/returns' },
  { label: 'Voucher cửa hàng', to: '/vendor/promotions' },
  { label: 'Đánh giá và phản hồi', to: '/vendor/reviews' },
];
