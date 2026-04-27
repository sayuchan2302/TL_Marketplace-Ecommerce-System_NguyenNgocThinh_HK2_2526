import { Store } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import AdminLayout, { type PanelNavItem } from '../Admin/AdminLayout';
import { VENDOR_DICTIONARY } from './vendorDictionary';
import { vendorPanelNav } from '../../config/panelNavigation';
import { storeService } from '../../services/storeService';

interface VendorLayoutProps {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  hideTopbarTitle?: boolean;
  breadcrumbs?: string[];
}

const t = VENDOR_DICTIONARY.layout;
const VENDOR_STORE_NAME_CACHE_KEY = 'vendor_store_name_cache';
let vendorStoreNameMemoryCache = '';

const vendorNavItems: PanelNavItem[] = vendorPanelNav;

const VendorLayout = ({ title, actions, children, hideTopbarTitle = false, breadcrumbs }: VendorLayoutProps) => {
  const getInitialStoreName = () => {
    if (vendorStoreNameMemoryCache) return vendorStoreNameMemoryCache;
    if (typeof window === 'undefined') return '';
    const fromSession = window.sessionStorage.getItem(VENDOR_STORE_NAME_CACHE_KEY) || '';
    if (fromSession) {
      vendorStoreNameMemoryCache = fromSession;
      return fromSession;
    }
    return '';
  };

  const [storeName, setStoreName] = useState<string>(getInitialStoreName);

  useEffect(() => {
    let mounted = true;
    void storeService
      .getMyStore()
      .then((store) => {
        if (!mounted) return;
        const nextName = (store.name || '').trim();
        if (!nextName) return;
        vendorStoreNameMemoryCache = nextName;
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(VENDOR_STORE_NAME_CACHE_KEY, nextName);
        }
        setStoreName(nextName);
      })
      .catch(() => {
        if (!mounted) return;
        setStoreName((current) => current || '');
      });

    return () => {
      mounted = false;
    };
  }, []);

  const layoutBrandName = storeName || vendorStoreNameMemoryCache || t.logo;
  const normalizedBreadcrumbs = useMemo(() => {
    if (!breadcrumbs?.length) return breadcrumbs;
    const [first, ...rest] = breadcrumbs;
    if (first !== t.logo) return breadcrumbs;
    return [layoutBrandName, ...rest];
  }, [breadcrumbs, layoutBrandName]);

  return (
    <AdminLayout
      title={title}
      actions={actions}
      hideTopbarTitle={hideTopbarTitle}
      hideSidebarCard
      breadcrumbs={normalizedBreadcrumbs}
      navItems={vendorNavItems}
      logoIcon={<Store size={22} />}
      logoText={layoutBrandName}
      sidebarDescription={t.sidebar.description}
      sidebarCtaLabel={t.sidebar.cta}
      sidebarCtaTo="/vendor/storefront"
      searchPlaceholder={t.searchPlaceholder}
      notificationsLabel={t.notifications}
      settingsLabel={t.settings}
    >
      {children}
    </AdminLayout>
  );
};

export default VendorLayout;
