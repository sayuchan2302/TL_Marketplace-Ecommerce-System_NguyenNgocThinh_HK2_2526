import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, ChevronLeft, Mail, MapPin, MessageCircle, Phone, ShoppingBag, Star, Users } from 'lucide-react';
import { storeService, type StoreProduct, type StoreProfile } from '../../services/storeService';
import { couponService, type Coupon } from '../../services/couponService';
import { customerVoucherService } from '../../services/customerVoucherService';
import { reviewService, type Review } from '../../services/reviewService';
import { storeFollowService } from '../../services/storeFollowService';
import { ApiError, hasBackendJwt } from '../../services/apiClient';
import { useToast } from '../../contexts/ToastContext';
import {
  BrowseTabContent,
  CategoriesTabContent,
  ProductsTabContent,
  ReviewsTabContent,
  StorefrontTabPanel,
  type PaginationToken,
} from './components/StoreProfileTabSections';
import './StoreProfile.css';

type StoreTab = 'browse' | 'products' | 'categories' | 'reviews';
type PanelHeightMap = Record<StoreTab, number>;
type IdleCapableWindow = Window & typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const TAB_ITEMS: Array<{ id: StoreTab; label: string }> = [
  { id: 'browse', label: 'D\u1EA1o' },
  { id: 'products', label: 'T\u1EA5t c\u1EA3 s\u1EA3n ph\u1EA9m' },
  { id: 'categories', label: 'Danh m\u1EE5c' },
  { id: 'reviews', label: '\u0110\u00E1nh gi\u00E1' },
];

const EMPTY_PANEL_HEIGHTS: PanelHeightMap = {
  browse: 0,
  products: 0,
  categories: 0,
  reviews: 0,
};

const PLACEHOLDER_BANNER =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&h=600&fit=crop';
const PRODUCTS_PAGE_SIZE = 25;
const MAX_PRODUCT_SNAPSHOT_PAGES = 5;
const CATEGORY_PREFETCH_DELAY_MS = 180;

const formatPercent = (value?: number) => `${Math.max(0, Math.min(100, Math.round(Number(value || 0))))}%`;

const formatShortNumber = (value: number) => {
  const safe = Math.max(0, Number(value || 0));
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}K`;
  return safe.toLocaleString('vi-VN');
};

const loadAllStoreProducts = async (
  storeId: string,
  pageSize = 60,
  maxPages = MAX_PRODUCT_SNAPSHOT_PAGES,
): Promise<StoreProduct[]> => {
  const firstPage = await storeService.getStoreProducts(storeId, 1, pageSize);
  const totalPages = Math.max(1, Number(firstPage.totalPages || 1));
  const rows = [...(firstPage.products || [])];

  if (totalPages <= 1) return rows;

  const maxPagesToFetch = Math.min(totalPages, Math.max(1, Number(maxPages || 1)));
  const remainingCalls: Array<Promise<Awaited<ReturnType<typeof storeService.getStoreProducts>>>> = [];

  for (let page = 2; page <= maxPagesToFetch; page += 1) {
    remainingCalls.push(storeService.getStoreProducts(storeId, page, pageSize));
  }

  const settled = await Promise.allSettled(remainingCalls);
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      rows.push(...(result.value.products || []));
    }
  }

  return rows;
};

const buildLoginRedirectTarget = () => {
  if (typeof window === 'undefined') return '/login';
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?reason=${encodeURIComponent('auth-required')}&redirect=${encodeURIComponent(current)}`;
};

const buildPaginationTokens = (page: number, totalPages: number): PaginationToken[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  if (page <= 3) {
    return [1, 2, 3, 4, 'ellipsis-right', totalPages];
  }

  if (page >= totalPages - 2) {
    return [1, 'ellipsis-left', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis-left', page - 1, page, page + 1, 'ellipsis-right', totalPages];
};

const StoreProfilePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [featuredProducts, setFeaturedProducts] = useState<StoreProduct[]>([]);
  const [productPageItems, setProductPageItems] = useState<StoreProduct[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productTotal, setProductTotal] = useState(0);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [productPageLoading, setProductPageLoading] = useState(false);
  const [categoryProducts, setCategoryProducts] = useState<StoreProduct[] | null>(null);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [vouchers, setVouchers] = useState<Coupon[]>([]);
  const [claimedVoucherIds, setClaimedVoucherIds] = useState<Set<string>>(() => new Set<string>());
  const [claimingVoucherId, setClaimingVoucherId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followSubmitting, setFollowSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StoreTab>('browse');
  const [isTabPending, startTabTransition] = useTransition();
  const [panelHeights, setPanelHeights] = useState<PanelHeightMap>(EMPTY_PANEL_HEIGHTS);
  const [stageMinHeight, setStageMinHeight] = useState(0);
  const storeRequestRef = useRef(0);
  const paginationRequestRef = useRef(0);
  const categoryRequestRef = useRef(0);
  const categoryFetchInFlightRef = useRef(false);
  const idleCategoryPrefetchRef = useRef<number | null>(null);
  const panelNodesRef = useRef<Record<StoreTab, HTMLDivElement | null>>({
    browse: null,
    products: null,
    categories: null,
    reviews: null,
  });

  const { addToast } = useToast();

  const setPanelNode = useCallback((tab: StoreTab, node: HTMLDivElement | null) => {
    panelNodesRef.current[tab] = node;
  }, []);

  const resetStorefrontUiState = useCallback(() => {
    setActiveTab('browse');
    setProductPage(1);
    setProductTotal(0);
    setProductTotalPages(1);
    setProductPageLoading(false);
    setFeaturedProducts([]);
    setProductPageItems([]);
    setCategoryProducts(null);
    setCategoryLoading(false);
    setClaimedVoucherIds(new Set<string>());
    setClaimingVoucherId(null);
    setPanelHeights(EMPTY_PANEL_HEIGHTS);
    setStageMinHeight(0);
    setLoading(true);
  }, []);

  const applyStoreUnavailableState = useCallback(() => {
    setVouchers([]);
    setClaimedVoucherIds(new Set<string>());
    setReviews([]);
    setFollowerCount(0);
    setIsFollowing(false);
  }, []);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    const requestId = storeRequestRef.current + 1;
    storeRequestRef.current = requestId;
    paginationRequestRef.current += 1;
    categoryRequestRef.current += 1;
    categoryFetchInFlightRef.current = false;

    if (idleCategoryPrefetchRef.current !== null && typeof window !== 'undefined') {
      const idleWindow = window as IdleCapableWindow;
      if (typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(idleCategoryPrefetchRef.current);
      } else {
        window.clearTimeout(idleCategoryPrefetchRef.current);
      }
      idleCategoryPrefetchRef.current = null;
    }

    const isCurrentRequest = () => !cancelled && storeRequestRef.current === requestId;

    const fetchData = async () => {
      resetStorefrontUiState();

      try {
        const storeRow = await storeService.getStoreBySlug(slug);
        if (!isCurrentRequest()) return;

        setStore(storeRow);
        if (!storeRow) {
          applyStoreUnavailableState();
          return;
        }

        const claimedVoucherPromise = hasBackendJwt()
          ? customerVoucherService.getClaimedVoucherIdsByStore(storeRow.id).catch(() => new Set<string>())
          : Promise.resolve(new Set<string>());

        const [initialProductPage, couponRes, reviewRes, followerRes, claimedVoucherSet] = await Promise.all([
          storeService.getStoreProducts(storeRow.id, 1, PRODUCTS_PAGE_SIZE),
          couponService.getAvailableCoupons([storeRow.id]).catch(() => [] as Coupon[]),
          reviewService.getReviewsByStore(storeRow.id).catch(() => [] as Review[]),
          storeFollowService.getFollowerCount(storeRow.id).catch(() => ({
            storeId: storeRow.id,
            followerCount: 0,
            followedByCurrentUser: false,
          })),
          claimedVoucherPromise,
        ]);
        if (!isCurrentRequest()) return;

        setFeaturedProducts(initialProductPage.products || []);
        setProductPageItems(initialProductPage.products || []);
        setProductPage(Math.max(Number(initialProductPage.page || 1), 1));
        setProductTotal(Math.max(Number(initialProductPage.total || 0), 0));
        setProductTotalPages(Math.max(Number(initialProductPage.totalPages || 1), 1));
        setVouchers(couponRes || []);
        setClaimedVoucherIds(new Set(claimedVoucherSet));
        setReviews(reviewRes || []);
        setFollowerCount(Math.max(0, Number(followerRes.followerCount || 0)));
        setIsFollowing(Boolean(followerRes.followedByCurrentUser));

        if (hasBackendJwt()) {
          try {
            const followStatus = await storeFollowService.getFollowStatus(storeRow.id);
            if (!isCurrentRequest()) return;
            setFollowerCount(Math.max(0, Number(followStatus.followerCount || 0)));
            setIsFollowing(Boolean(followStatus.followedByCurrentUser));
          } catch {
            // ignore follow status fetch errors for unauthenticated/degraded state
          }
        }
      } finally {
        if (isCurrentRequest()) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [applyStoreUnavailableState, resetStorefrontUiState, slug]);

  const ensureCategorySnapshot = useCallback(async () => {
    if (!store?.id || categoryProducts !== null || categoryFetchInFlightRef.current) return;

    const storeId = store.id;
    const storeRequestId = storeRequestRef.current;
    const requestId = categoryRequestRef.current + 1;
    categoryRequestRef.current = requestId;
    categoryFetchInFlightRef.current = true;
    setCategoryLoading(true);

    try {
      const rows = await loadAllStoreProducts(storeId, 60);
      if (storeRequestRef.current !== storeRequestId || categoryRequestRef.current !== requestId) return;
      setCategoryProducts(rows || []);
    } catch {
      if (storeRequestRef.current === storeRequestId && categoryRequestRef.current === requestId) {
        setCategoryProducts([]);
      }
    } finally {
      if (storeRequestRef.current === storeRequestId && categoryRequestRef.current === requestId) {
        categoryFetchInFlightRef.current = false;
        setCategoryLoading(false);
      }
    }
  }, [categoryProducts, store?.id]);

  useEffect(() => {
    if (loading || !store?.id || categoryProducts !== null) return;

    const idleWindow = window as IdleCapableWindow;
    const triggerPrefetch = () => {
      idleCategoryPrefetchRef.current = null;
      void ensureCategorySnapshot();
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleCategoryPrefetchRef.current = idleWindow.requestIdleCallback(() => {
        triggerPrefetch();
      });
    } else {
      idleCategoryPrefetchRef.current = window.setTimeout(triggerPrefetch, CATEGORY_PREFETCH_DELAY_MS);
    }

    return () => {
      if (idleCategoryPrefetchRef.current === null) return;
      if (typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(idleCategoryPrefetchRef.current);
      } else {
        window.clearTimeout(idleCategoryPrefetchRef.current);
      }
      idleCategoryPrefetchRef.current = null;
    };
  }, [categoryProducts, ensureCategorySnapshot, loading, store?.id]);

  useEffect(() => {
    if (activeTab !== 'categories' || categoryProducts !== null || categoryLoading) return;
    void ensureCategorySnapshot();
  }, [activeTab, categoryLoading, categoryProducts, ensureCategorySnapshot]);

  useLayoutEffect(() => {
    if (loading || typeof ResizeObserver === 'undefined') return;

    const updateHeight = (tab: StoreTab, nextHeight: number) => {
      const normalizedHeight = Math.max(0, nextHeight);
      setPanelHeights((prev) => (prev[tab] === normalizedHeight ? prev : { ...prev, [tab]: normalizedHeight }));
    };

    for (const tab of TAB_ITEMS.map((item) => item.id)) {
      const node = panelNodesRef.current[tab];
      if (!node) continue;
      updateHeight(tab, Math.ceil(node.getBoundingClientRect().height));
    }

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const tab = TAB_ITEMS.find((item) => panelNodesRef.current[item.id] === entry.target)?.id;
        if (!tab) continue;
        updateHeight(tab, Math.ceil(entry.contentRect.height));
      }
    });

    for (const tab of TAB_ITEMS.map((item) => item.id)) {
      const node = panelNodesRef.current[tab];
      if (node) {
        observer.observe(node);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [loading, store?.id]);

  useLayoutEffect(() => {
    setStageMinHeight(Math.max(0, panelHeights[activeTab] || 0));
  }, [activeTab, panelHeights]);

  const handleClaimVoucher = useCallback(async (voucher: Coupon) => {
    const voucherId = String(voucher.id || '').trim();
    if (!voucherId) {
      return;
    }

    if (!hasBackendJwt()) {
      if (typeof window !== 'undefined') {
        window.location.href = buildLoginRedirectTarget();
      }
      return;
    }

    if (claimedVoucherIds.has(voucherId) || claimingVoucherId === voucherId) {
      return;
    }

    setClaimingVoucherId(voucherId);
    try {
      await customerVoucherService.claimVoucher(voucherId);
      setClaimedVoucherIds((current) => {
        const next = new Set(current);
        next.add(voucherId);
        return next;
      });
      addToast(`\u0110\u00E3 nh\u1EADn voucher ${voucher.code}`, 'success');
    } catch (error) {
      const message = error instanceof ApiError
        ? error.message
        : (error instanceof Error ? error.message : 'Kh\u00F4ng th\u1EC3 nh\u1EADn voucher l\u00FAc n\u00E0y.');
      addToast(message || 'Kh\u00F4ng th\u1EC3 nh\u1EADn voucher l\u00FAc n\u00E0y.', 'error');
    } finally {
      setClaimingVoucherId((current) => (current === voucherId ? null : current));
    }
  }, [addToast, claimedVoucherIds, claimingVoucherId]);

  const handleToggleFollow = async () => {
    if (!store || followSubmitting) return;

    if (!hasBackendJwt()) {
      if (typeof window !== 'undefined') {
        window.location.href = buildLoginRedirectTarget();
      }
      return;
    }

    setFollowSubmitting(true);
    try {
      const shouldSyncWalletVoucher = !isFollowing;
      const response = isFollowing
        ? await storeFollowService.unfollow(store.id)
        : await storeFollowService.follow(store.id);

      setFollowerCount(Math.max(0, Number(response.followerCount || 0)));
      setIsFollowing(Boolean(response.followedByCurrentUser));

      if (shouldSyncWalletVoucher) {
        try {
          const claimedIds = await customerVoucherService.getClaimedVoucherIdsByStore(store.id);
          setClaimedVoucherIds(claimedIds);
        } catch {
          // ignore wallet sync failure after follow
        }
      }
    } finally {
      setFollowSubmitting(false);
    }
  };

  const contactAction = useMemo(() => {
    const phone = String(store?.phone || '').trim();
    if (phone) {
      return {
        href: `tel:${phone.replace(/\s+/g, '')}`,
        label: 'G\u1ECDi shop',
      };
    }

    const email = String(store?.contactEmail || '').trim();
    if (email) {
      return {
        href: `mailto:${email}`,
        label: 'Email shop',
      };
    }

    return null;
  }, [store?.contactEmail, store?.phone]);

  const handleContactStore = useCallback(() => {
    if (!contactAction || typeof window === 'undefined') return;
    window.location.href = contactAction.href;
  }, [contactAction]);

  const handleTabChange = (tab: StoreTab) => {
    if (tab === activeTab) return;
    startTabTransition(() => {
      setActiveTab(tab);
    });
  };

  const scrollToProductsPanelTop = useCallback(() => {
    if (typeof window === 'undefined') return;
    const productsPanel = panelNodesRef.current.products;
    if (!productsPanel) return;

    const headerOffset = 96;
    const targetTop = productsPanel.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: 'smooth',
    });
  }, []);

  const handleProductPageChange = useCallback(async (nextPage: number) => {
    if (!store?.id || productPageLoading || nextPage === productPage) return;

    const storeId = store.id;
    const storeRequestId = storeRequestRef.current;
    const requestId = paginationRequestRef.current + 1;
    paginationRequestRef.current = requestId;

    setProductPageLoading(true);
    scrollToProductsPanelTop();
    try {
      const response = await storeService.getStoreProducts(storeId, nextPage, PRODUCTS_PAGE_SIZE);
      if (storeRequestRef.current !== storeRequestId || paginationRequestRef.current !== requestId) return;
      setProductPageItems(response.products || []);
      setProductPage(Math.max(Number(response.page || nextPage), 1));
      setProductTotal(Math.max(Number(response.total || 0), 0));
      setProductTotalPages(Math.max(Number(response.totalPages || 1), 1));
    } catch {
      // keep current page data if pagination request fails
    } finally {
      if (storeRequestRef.current === storeRequestId && paginationRequestRef.current === requestId) {
        setProductPageLoading(false);
      }
    }
  }, [productPage, productPageLoading, scrollToProductsPanelTop, store?.id]);

  const onlineLabel = store?.status === 'ACTIVE' ? '\u0110ang online' : 'T\u1EA1m offline';

  const topSellingProducts = useMemo(
    () => [...featuredProducts].sort((a, b) => Number(b.soldCount || 0) - Number(a.soldCount || 0)).slice(0, 8),
    [featuredProducts],
  );

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, StoreProduct[]>();
    for (const product of categoryProducts || []) {
      const key = product.categoryName || 'Danh m\u1EE5c kh\u00E1c';
      const bucket = groups.get(key) || [];
      bucket.push(product);
      groups.set(key, bucket);
    }
    return Array.from(groups.entries()).map(([name, rows]) => ({ name, rows }));
  }, [categoryProducts]);

  const paginationTokens = useMemo(
    () => buildPaginationTokens(productPage, productTotalPages),
    [productPage, productTotalPages],
  );

  if (loading) {
    return (
      <div className="storefront-state-page">
        <div className="storefront-loader" />
        <p>\u0110ang t\u1EA3i th\u00F4ng tin c\u1EEDa h\u00E0ng...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="storefront-state-page">
        <div className="storefront-not-found">
          <h2>C\u1EEDa h\u00E0ng kh\u00F4ng t\u1ED3n t\u1EA1i</h2>
          <p>Li\u00EAn k\u1EBFt c\u00F3 th\u1EC3 \u0111\u00E3 h\u1EBFt hi\u1EC7u l\u1EF1c ho\u1EB7c c\u1EEDa h\u00E0ng ch\u01B0a \u0111\u01B0\u1EE3c c\u00F4ng khai.</p>
          <Link to="/" className="storefront-primary-btn">
            <ChevronLeft size={16} />
            Quay v\u1EC1 trang ch\u1EE7
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="storefront-page">
      <div className="storefront-shell">
        <section className="storefront-summary-wrap">
          <div className="storefront-summary">
            <div className="storefront-summary-main">
              <div className="storefront-brand">
                {store.logo ? (
                  <img src={store.logo} alt={store.name} className="storefront-logo" />
                ) : (
                  <div className="storefront-logo-placeholder">{store.name.charAt(0).toUpperCase()}</div>
                )}
                <div className="storefront-brand-text">
                  <div className="storefront-brand-title">
                    <h1>{store.name}</h1>
                    {store.isOfficial ? (
                      <span className="storefront-badge">
                        <BadgeCheck size={14} />
                        Mall
                      </span>
                    ) : null}
                    <span
                      className={`storefront-status ${
                        store.status === 'ACTIVE' ? 'storefront-status-active' : 'storefront-status-offline'
                      }`}
                    >
                      <span className="storefront-status-dot" />
                      {onlineLabel}
                    </span>
                  </div>
                  <p className="storefront-description">
                    {store.description || 'C\u1EEDa h\u00E0ng \u0111\u1ED1i t\u00E1c ch\u00EDnh th\u1EE9c tr\u00EAn marketplace.'}
                  </p>
                  {store.contactEmail || store.phone || store.address ? (
                    <div className="storefront-public-contact">
                      {store.contactEmail ? (
                        <span>
                          <Mail size={13} />
                          {store.contactEmail}
                        </span>
                      ) : null}
                      {store.phone ? (
                        <span>
                          <Phone size={13} />
                          {store.phone}
                        </span>
                      ) : null}
                      {store.address ? (
                        <span>
                          <MapPin size={13} />
                          {store.address}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="storefront-actions">
                    <button
                      type="button"
                      className={`storefront-primary-btn ${isFollowing ? 'storefront-primary-btn-muted' : ''}`}
                      onClick={handleToggleFollow}
                      disabled={followSubmitting}
                    >
                      {followSubmitting ? '\u0110ang x\u1EED l\u00FD...' : isFollowing ? '\u0110\u00E3 theo d\u00F5i' : 'Theo d\u00F5i'}
                    </button>
                    <button
                      type="button"
                      className={`storefront-secondary-btn ${contactAction ? '' : 'storefront-secondary-btn-disabled'}`}
                      disabled={!contactAction}
                      onClick={handleContactStore}
                      title={contactAction ? undefined : 'C\u1EEDa h\u00E0ng ch\u01B0a c\u1EADp nh\u1EADt th\u00F4ng tin li\u00EAn h\u1EC7'}
                    >
                      <MessageCircle size={16} />
                      {contactAction ? contactAction.label : 'Ch\u01B0a c\u00F3 li\u00EAn h\u1EC7'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="storefront-metrics">
                <article className="storefront-metric-card">
                  <p>
                    <Star size={14} />
                    Rating
                  </p>
                  <strong>{store.rating.toFixed(1)}</strong>
                </article>
                <article className="storefront-metric-card">
                  <p>
                    <MessageCircle size={14} />
                    T\u1EF7 l\u1EC7 ph\u1EA3n h\u1ED3i
                  </p>
                  <strong>{formatPercent(store.responseRate)}</strong>
                </article>
                <article className="storefront-metric-card">
                  <p>
                    <Users size={14} />
                    Ng\u01B0\u1EDDi theo d\u00F5i
                  </p>
                  <strong>{formatShortNumber(followerCount)}</strong>
                </article>
                <article className="storefront-metric-card">
                  <p>
                    <ShoppingBag size={14} />
                    \u0110\u01A1n h\u00E0ng
                  </p>
                  <strong>{formatShortNumber(Number(store.totalOrders || 0))}</strong>
                </article>
              </div>
            </div>

            <div className="storefront-tabs">
              {TAB_ITEMS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`storefront-tab ${activeTab === tab.id ? 'storefront-tab-active' : ''} ${isTabPending ? 'is-pending' : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </section>
        <section className="storefront-section">
          <div
            className="storefront-tab-stage"
            style={stageMinHeight > 0 ? { minHeight: `${stageMinHeight}px` } : undefined}
          >
            <StorefrontTabPanel active={activeTab === 'browse'} panelRef={(node) => setPanelNode('browse', node)}>
              <BrowseTabContent
                vouchers={vouchers}
                isAuthenticated={hasBackendJwt()}
                claimedVoucherIds={claimedVoucherIds}
                claimingVoucherId={claimingVoucherId}
                onClaimVoucher={handleClaimVoucher}
                storeName={store.name}
                bannerUrl={store.banner || PLACEHOLDER_BANNER}
                topSellingProducts={topSellingProducts}
              />
            </StorefrontTabPanel>

            <StorefrontTabPanel active={activeTab === 'products'} panelRef={(node) => setPanelNode('products', node)}>
              <ProductsTabContent
                productTotal={productTotal}
                productPage={productPage}
                productTotalPages={productTotalPages}
                productPageItems={productPageItems}
                productPageLoading={productPageLoading}
                paginationTokens={paginationTokens}
                storeName={store.name}
                onPageChange={(nextPage) => {
                  void handleProductPageChange(nextPage);
                }}
              />
            </StorefrontTabPanel>

            <StorefrontTabPanel active={activeTab === 'categories'} panelRef={(node) => setPanelNode('categories', node)}>
              <CategoriesTabContent
                categoryLoading={categoryLoading}
                groupedByCategory={groupedByCategory}
              />
            </StorefrontTabPanel>

            <StorefrontTabPanel active={activeTab === 'reviews'} panelRef={(node) => setPanelNode('reviews', node)}>
              <ReviewsTabContent reviews={reviews} />
            </StorefrontTabPanel>
          </div>
        </section>
      </div>
    </div>
  );
};

export default StoreProfilePage;

