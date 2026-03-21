import './Admin.css';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, Search, Bell, Settings, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { ADMIN_TEXT } from './adminText';

interface AdminLayoutProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  hideTopbarTitle?: boolean;
}

const navItems = [
  { label: ADMIN_TEXT.layout.nav.dashboard, to: '/admin' },
  { label: ADMIN_TEXT.layout.nav.orders, to: '/admin/orders' },
  { label: ADMIN_TEXT.layout.nav.products, to: '/admin/products' },
  { label: ADMIN_TEXT.layout.nav.categories, to: '/admin/categories' },
  { label: ADMIN_TEXT.layout.nav.customers, to: '/admin/customers' },
  { label: ADMIN_TEXT.layout.nav.promotions, to: '/admin/promotions' },
  { label: ADMIN_TEXT.layout.nav.content, to: '/admin/content' },
  { label: ADMIN_TEXT.layout.nav.settings, to: '/admin/settings' },
];

const AdminLayout = ({ title, actions, children, hideTopbarTitle = false }: AdminLayoutProps) => {
  const location = useLocation();
  const t = ADMIN_TEXT.layout;

  const breadcrumbs = () => {
    const path = location.pathname;
    if (path.startsWith('/admin/orders/')) return [t.nav.orders, t.breadcrumbs.orderDetail];
    if (path.startsWith('/admin/orders')) return [t.nav.orders, t.breadcrumbs.orderList];
    if (path.startsWith('/admin/products')) return [t.nav.products, t.breadcrumbs.productList];
    if (path.startsWith('/admin/categories')) return [t.nav.categories, t.breadcrumbs.categoryList];
    if (path.startsWith('/admin/customers') || path.startsWith('/admin/customer')) return [t.nav.customers, t.breadcrumbs.customerList];
    if (path.startsWith('/admin/promotions')) return [t.nav.promotions, t.breadcrumbs.promoList];
    return [t.nav.dashboard];
  };

  const crumbs = breadcrumbs();

  return (
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <LayoutGrid size={22} />
          <span>{t.logo}</span>
        </div>
        <nav className="admin-nav">
          {navItems.map((item) => {
            const isActive = item.to === '/admin' 
              ? location.pathname === '/admin' 
              : location.pathname.startsWith(item.to);
              
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`admin-nav-link ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="admin-sidebar-card">
          <p>{t.sidebar.description}</p>
          <Link to="/admin/settings" className="admin-sidebar-btn">{t.sidebar.cta}</Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-breadcrumbs" aria-label="Breadcrumb">
            {crumbs.map((crumb, idx) => (
              <span key={crumb} className="breadcrumb-item">
                {crumb}
                {idx < crumbs.length - 1 && <ChevronRight size={14} />}
              </span>
            ))}
          </div>

          <div className="admin-header-search">
            <Search size={16} />
            <input placeholder={t.searchPlaceholder} aria-label={t.searchPlaceholder} />
          </div>

          <div className="admin-header-actions">
            <button className="admin-icon-btn subtle has-dot" aria-label={t.notifications}>
              <Bell size={16} />
              <span className="notif-dot" />
            </button>
            <button className="admin-icon-btn subtle" aria-label={t.settings}>
              <Settings size={16} />
            </button>
            <div className="admin-avatar">
              <span className="avatar-circle">A</span>
              <span className="avatar-name">{t.adminName}</span>
            </div>
          </div>
        </header>

        <div className="admin-topbar actions-row">
          {!hideTopbarTitle ? <h1>{title}</h1> : <div className="admin-topbar-title-spacer" />}
          <div className="admin-topbar-actions">{actions}</div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
