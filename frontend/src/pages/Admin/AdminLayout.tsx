import './Admin.css';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutGrid, Search, Bell, Settings, ChevronRight, LogOut, Home } from 'lucide-react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { ADMIN_DICTIONARY } from './adminDictionary';
import { authService } from '../../services/authService';
import { useToast } from '../../contexts/ToastContext';
import { adminPanelNav } from '../../config/panelNavigation';
import { AdminShellContext } from './AdminShellContext';
import PageTransition from '../../components/Transitions/PageTransition';

export interface PanelNavItem {
  label: string;
  to: string;
  exact?: boolean;
}

interface AdminLayoutProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  hideTopbarTitle?: boolean;
  breadcrumbs?: string[];
  navItems?: PanelNavItem[];
  logoIcon?: ReactNode;
  logoText?: string;
  sidebarDescription?: string;
  sidebarCtaLabel?: string;
  sidebarCtaTo?: string;
  searchPlaceholder?: string;
  notificationsLabel?: string;
  settingsLabel?: string;
}

const defaultNavItems: PanelNavItem[] = adminPanelNav;
const AdminLayoutLevelContext = createContext(false);

const AdminLayout = ({
  title,
  actions,
  children,
  hideTopbarTitle = false,
  breadcrumbs,
  navItems = defaultNavItems,
  logoIcon,
  logoText,
  sidebarDescription,
  sidebarCtaLabel,
  sidebarCtaTo,
  searchPlaceholder,
  notificationsLabel,
  settingsLabel,
}: AdminLayoutProps) => {
  const isNested = useContext(AdminLayoutLevelContext);
  const setShellState = useContext(AdminShellContext);
  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const t = ADMIN_DICTIONARY.layout;

  const sessionUser = authService.getSession()?.user || authService.getAdminSession()?.user;
  const displayName = sessionUser?.name?.trim() || t.adminName;
  const displayEmail = sessionUser?.email?.trim() || 'Chưa có email';
  const displayAvatar = sessionUser?.avatar || displayName.charAt(0).toUpperCase() || '?';

  const handleLogout = () => {
    authService.logout();
    authService.adminLogout();
    addToast('Đã đăng xuất', 'info');
    navigate('/');
  };

  const handleGoHome = () => {
    setIsDropdownOpen(false);
    navigate('/');
  };

  const inferBreadcrumbs = () => {
    const path = location.pathname;
    if (path.startsWith('/admin/orders/')) return [t.nav.orders, t.breadcrumbs.orderDetail];
    if (path.startsWith('/admin/orders')) return [t.nav.orders, t.breadcrumbs.orderList];
    if (path.startsWith('/admin/product-governance')) return [t.nav.products, 'Kiểm duyệt'];
    if (path.startsWith('/admin/products')) return [t.nav.products, t.breadcrumbs.productList];
    if (path.startsWith('/admin/categories')) return [t.nav.categories, t.breadcrumbs.categoryList];
    if (path.startsWith('/admin/customers') || path.startsWith('/admin/customer')) return [t.nav.customers, t.breadcrumbs.customerList];
    if (path.startsWith('/admin/promotions')) return [t.nav.promotions, t.breadcrumbs.promoList];
    if (path.startsWith('/admin/reviews')) return [ADMIN_DICTIONARY.reviews.title, t.breadcrumbs.reviewList];
    return [t.nav.dashboard];
  };

  const crumbs = breadcrumbs?.length ? breadcrumbs : inferBreadcrumbs();

  useEffect(() => {
    if (setShellState) {
      setShellState({ title, actions, hideTopbarTitle, breadcrumbs });
    }
  }, [actions, breadcrumbs, hideTopbarTitle, setShellState, title]);

  if (isNested) {
    // When wrapped by a parent AdminLayout, only render content; shell (sidebar/header) handled by parent.
    return <>{children}</>;
  }

  return (
    <AdminLayoutLevelContext.Provider value={true}>
    <div className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          {logoIcon || <LayoutGrid size={22} />}
          <span>{logoText || t.logo}</span>
        </div>
        <nav className="admin-nav">
          {navItems.map((item) => {
            const isActive = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

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
          <p>{sidebarDescription || t.sidebar.description}</p>
          <Link to={sidebarCtaTo || '/admin/settings'} className="admin-sidebar-btn">
            {sidebarCtaLabel || t.sidebar.cta}
          </Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-header">
          <div className="admin-breadcrumbs" aria-label="Breadcrumb">
            {crumbs.map((crumb, idx) => (
              <span key={`${crumb}-${idx}`} className="breadcrumb-item">
                {crumb}
                {idx < crumbs.length - 1 && <ChevronRight size={14} />}
              </span>
            ))}
          </div>

          <div className="admin-header-search">
            <Search size={16} />
            <input
              placeholder={searchPlaceholder || t.searchPlaceholder}
              aria-label={searchPlaceholder || t.searchPlaceholder}
            />
          </div>

          <div className="admin-header-actions">
            <button className="admin-icon-btn subtle has-dot" aria-label={notificationsLabel || t.notifications}>
              <Bell size={16} />
              <span className="notif-dot" />
            </button>
            <button className="admin-icon-btn subtle" aria-label={settingsLabel || t.settings}>
              <Settings size={16} />
            </button>
            <div
              className="admin-avatar-wrapper"
              onMouseEnter={() => setIsDropdownOpen(true)}
              onMouseLeave={() => setIsDropdownOpen(false)}
            >
              <button className="admin-avatar-btn">
                <span className="avatar-circle">{displayAvatar}</span>
                <span className="avatar-name">{displayName}</span>
              </button>
              <div className={`admin-avatar-dropdown ${isDropdownOpen ? 'show' : ''}`}>
                <div className="admin-dropdown-header">
                  <span className="admin-dropdown-avatar">{displayAvatar}</span>
                  <div className="admin-dropdown-info">
                    <span className="admin-dropdown-name">{displayName}</span>
                    <span className="admin-dropdown-email">{displayEmail}</span>
                  </div>
                </div>
                <div className="admin-dropdown-divider"></div>
                <button className="admin-dropdown-item" onClick={handleGoHome}>
                  <Home size={16} />
                  Quay về trang chủ
                </button>
                <div className="admin-dropdown-divider"></div>
                <button className="admin-dropdown-item logout" onClick={handleLogout}>
                  <LogOut size={16} />
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="admin-content-inner">
          <div className="admin-topbar actions-row">
            {!hideTopbarTitle ? <h1>{title}</h1> : <div className="admin-topbar-title-spacer" />}
            {actions ? <div className="admin-topbar-actions">{actions}</div> : null}
          </div>
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
    </AdminLayoutLevelContext.Provider>
  );
};

export default AdminLayout;
