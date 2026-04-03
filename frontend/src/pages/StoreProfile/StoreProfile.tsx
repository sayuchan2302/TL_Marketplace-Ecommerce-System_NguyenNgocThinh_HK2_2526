import { useEffect, useMemo, useState, useTransition } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, ChevronLeft, MessageCircle, ShoppingBag, Star, TicketPercent, Users } from 'lucide-react';
import { storeService, type StoreProduct, type StoreProfile } from '../../services/storeService';
import { couponService, type Coupon } from '../../services/couponService';
import { reviewService, type Review } from '../../services/reviewService';
import { storeFollowService } from '../../services/storeFollowService';
import { hasBackendJwt } from '../../services/apiClient';
import ProductCard from '../../components/ProductCard/ProductCard';
import './StoreProfile.css';

type StoreTab = 'browse' | 'products' | 'categories' | 'reviews';

const TAB_ITEMS: Array<{ id: StoreTab; label: string }> = [
  { id: 'browse', label: 'Dạo' },
  { id: 'products', label: 'Tất cả sản phẩm' },
  { id: 'categories', label: 'Danh mục' },
  { id: 'reviews', label: 'Đánh giá' },
];

const PLACEHOLDER_BANNER =
  'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&h=600&fit=crop';

const formatCurrency = (value: number) => `${Math.max(0, Number(value || 0)).toLocaleString('vi-VN')}đ`;
const formatPercent = (value?: number) => `${Math.max(0, Math.min(100, Math.round(Number(value || 0))))}%`;

const formatShortNumber = (value: number) => {
  const safe = Math.max(0, Number(value || 0));
  if (safe >= 1_000_000) return `${(safe / 1_000_000).toFixed(1)}M`;
  if (safe >= 1_000) return `${(safe / 1_000).toFixed(1)}K`;
  return safe.toLocaleString('vi-VN');
};

const getProductLink = (product: StoreProduct) => product.slug || product.sku || String(product.id);
const PRODUCTS_BATCH_SIZE = 12;

const buildLoginRedirectTarget = () => {
  if (typeof window === 'undefined') return '/login';
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?reason=${encodeURIComponent('auth-required')}&redirect=${encodeURIComponent(current)}`;
};

interface ProductCardProps {
  product: StoreProduct;
  storeName: string;
}

const StoreProductCard = ({ product, storeName }: ProductCardProps) => {
  return (
    <ProductCard
      staticMode
      id={getProductLink(product)}
      sku={product.sku}
      name={product.name}
      price={product.price}
      originalPrice={product.originalPrice}
      image={product.image}
      badge={product.badge}
      colors={product.colors}
      sizes={product.sizes}
      storeId={product.storeId}
      storeName={product.storeName || storeName}
      storeSlug={product.storeSlug}
      isOfficialStore={product.isOfficialStore}
    />
  );
};

const StoreProfilePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreProfile | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [vouchers, setVouchers] = useState<Coupon[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followSubmitting, setFollowSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<StoreTab>('browse');
  const [visibleProductsCount, setVisibleProductsCount] = useState(PRODUCTS_BATCH_SIZE);
  const [isTabPending, startTabTransition] = useTransition();
  const [visitedTabs, setVisitedTabs] = useState<Record<StoreTab, boolean>>({
    browse: true,
    products: false,
    categories: false,
    reviews: false,
  });

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const storeRow = await storeService.getStoreBySlug(slug);
        if (cancelled) return;

        setStore(storeRow);
        if (!storeRow) {
          setProducts([]);
          setVouchers([]);
          setReviews([]);
          setFollowerCount(0);
          setIsFollowing(false);
          return;
        }

        const [productRes, couponRes, reviewRes, followerRes] = await Promise.all([
          storeService.getStoreProducts(storeRow.id, 1, 60),
          couponService.getAvailableCoupons([storeRow.id]).catch(() => [] as Coupon[]),
          reviewService.getReviewsByStore(storeRow.id).catch(() => [] as Review[]),
          storeFollowService.getFollowerCount(storeRow.id).catch(() => ({
            storeId: storeRow.id,
            followerCount: 0,
            followedByCurrentUser: false,
          })),
        ]);
        if (cancelled) return;

        setProducts(productRes.products || []);
        setVouchers(couponRes || []);
        setReviews(reviewRes || []);
        setFollowerCount(Math.max(0, Number(followerRes.followerCount || 0)));
        setIsFollowing(Boolean(followerRes.followedByCurrentUser));

        if (hasBackendJwt()) {
          try {
            const followStatus = await storeFollowService.getFollowStatus(storeRow.id);
            if (cancelled) return;
            setFollowerCount(Math.max(0, Number(followStatus.followerCount || 0)));
            setIsFollowing(Boolean(followStatus.followedByCurrentUser));
          } catch {
            // ignore follow status fetch errors for unauthenticated/degraded state
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    setVisibleProductsCount(PRODUCTS_BATCH_SIZE);
  }, [products.length, slug]);

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
      const response = isFollowing
        ? await storeFollowService.unfollow(store.id)
        : await storeFollowService.follow(store.id);

      setFollowerCount(Math.max(0, Number(response.followerCount || 0)));
      setIsFollowing(Boolean(response.followedByCurrentUser));
    } finally {
      setFollowSubmitting(false);
    }
  };

  const handleTabChange = (tab: StoreTab) => {
    if (tab === activeTab) return;
    startTabTransition(() => {
      setActiveTab(tab);
      setVisitedTabs((prev) => (prev[tab] ? prev : { ...prev, [tab]: true }));
    });
  };

  const onlineLabel = store?.status === 'ACTIVE' ? 'Đang online' : 'Tạm offline';

  const topSellingProducts = useMemo(
    () => [...products].sort((a, b) => Number(b.soldCount || 0) - Number(a.soldCount || 0)).slice(0, 8),
    [products],
  );

  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, StoreProduct[]>();
    for (const product of products) {
      const key = product.categoryName || 'Danh mục khác';
      const bucket = groups.get(key) || [];
      bucket.push(product);
      groups.set(key, bucket);
    }
    return Array.from(groups.entries()).map(([name, rows]) => ({ name, rows }));
  }, [products]);

  const visibleProducts = useMemo(
    () => products.slice(0, visibleProductsCount),
    [products, visibleProductsCount],
  );
  const hasMoreProducts = visibleProductsCount < products.length;

  const handleLoadMoreProducts = () => {
    startTabTransition(() => {
      setVisibleProductsCount((prev) => Math.min(prev + PRODUCTS_BATCH_SIZE, products.length));
    });
  };

  const renderGrid = (rows: StoreProduct[]) => {
    if (rows.length === 0) {
      return <p className="storefront-empty">Hiện chưa có sản phẩm công khai.</p>;
    }
    return (
      <div className="storefront-grid">
        {rows.map((product) => (
          <StoreProductCard key={`${product.id}-${product.sku}`} product={product} storeName={store?.name || ''} />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="storefront-state-page">
        <div className="storefront-loader" />
        <p>Đang tải thông tin cửa hàng...</p>
      </div>
    );
  }

  if (!store) {
    return (
      <div className="storefront-state-page">
        <div className="storefront-not-found">
          <h2>Cửa hàng không tồn tại</h2>
          <p>Liên kết có thể đã hết hiệu lực hoặc cửa hàng chưa được công khai.</p>
          <Link to="/" className="storefront-primary-btn">
            <ChevronLeft size={16} />
            Quay về trang chủ
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
                    {store.description || 'Cửa hàng đối tác chính thức trên marketplace.'}
                  </p>
                  <div className="storefront-actions">
                    <button
                      type="button"
                      className={`storefront-primary-btn ${isFollowing ? 'storefront-primary-btn-muted' : ''}`}
                      onClick={handleToggleFollow}
                      disabled={followSubmitting}
                    >
                      {followSubmitting ? 'Đang xử lý...' : isFollowing ? 'Đã theo dõi' : 'Theo dõi'}
                    </button>
                    <button type="button" className="storefront-secondary-btn">
                      <MessageCircle size={16} />
                      Chat
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
                    Tỷ lệ phản hồi
                  </p>
                  <strong>{formatPercent(store.responseRate)}</strong>
                </article>
                <article className="storefront-metric-card">
                  <p>
                    <Users size={14} />
                    Người theo dõi
                  </p>
                  <strong>{formatShortNumber(followerCount)}</strong>
                </article>
                <article className="storefront-metric-card">
                  <p>
                    <ShoppingBag size={14} />
                    Đơn hàng
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
          {visitedTabs.browse ? (
            <div className={`storefront-tab-panel ${activeTab === 'browse' ? 'is-active' : ''}`} hidden={activeTab !== 'browse'}>
              <div className="storefront-panel">
                <h2>Voucher cửa hàng</h2>
                {vouchers.length === 0 ? (
                  <p className="storefront-empty">Hiện chưa có voucher công khai cho gian hàng này.</p>
                ) : (
                  <div className="storefront-voucher-list">
                    {vouchers.slice(0, 10).map((voucher) => (
                      <article key={voucher.id || voucher.code} className="storefront-voucher">
                        <div className="storefront-voucher-cut storefront-voucher-cut-left" />
                        <div className="storefront-voucher-cut storefront-voucher-cut-right" />
                        <div className="storefront-voucher-content">
                          <div>
                            <p className="storefront-voucher-code">{voucher.code}</p>
                            <p className="storefront-voucher-text">
                              {voucher.type === 'percent'
                                ? `Giảm ${voucher.value}%`
                                : `Giảm ${formatCurrency(voucher.value)}`}
                            </p>
                            <p className="storefront-voucher-meta">
                              Đơn tối thiểu {formatCurrency(voucher.minOrderValue || 0)}
                            </p>
                          </div>
                          <TicketPercent size={18} />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="storefront-panel storefront-campaign">
                <img
                  src={store.banner || PLACEHOLDER_BANNER}
                  alt={store.name}
                  className="storefront-campaign-image"
                  loading="lazy"
                />
                <div className="storefront-campaign-overlay" />
                <div className="storefront-campaign-content">
                  <p>Campaign</p>
                  <h3>Ưu đãi nổi bật tại {store.name}</h3>
                  <span>Mua sắm an tâm với chính sách bảo vệ từ sàn.</span>
                </div>
              </div>

              <div className="storefront-panel">
                <div className="storefront-panel-head">
                  <h2>Sản phẩm được quan tâm</h2>
                  <span>{topSellingProducts.length} sản phẩm</span>
                </div>
                {renderGrid(topSellingProducts)}
              </div>
            </div>
          ) : null}

          {visitedTabs.products ? (
            <div className={`storefront-tab-panel ${activeTab === 'products' ? 'is-active' : ''}`} hidden={activeTab !== 'products'}>
              <div className="storefront-panel">
                <div className="storefront-panel-head">
                  <h2>Tất cả sản phẩm</h2>
                  <span>
                    Hiển thị {Math.min(visibleProducts.length, products.length)}/{products.length}
                  </span>
                </div>
                {renderGrid(visibleProducts)}
                {hasMoreProducts ? (
                  <div className="storefront-load-more-wrap">
                    <button
                      type="button"
                      className="storefront-load-more-btn"
                      onClick={handleLoadMoreProducts}
                      disabled={isTabPending}
                    >
                      {isTabPending ? 'Đang tải...' : 'Xem thêm sản phẩm'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {visitedTabs.categories ? (
            <div className={`storefront-tab-panel ${activeTab === 'categories' ? 'is-active' : ''}`} hidden={activeTab !== 'categories'}>
              <div className="storefront-stack">
                {groupedByCategory.map((group) => (
                  <div key={group.name} className="storefront-panel">
                    <div className="storefront-panel-head">
                      <h2>{group.name}</h2>
                      <span>{group.rows.length} sản phẩm</span>
                    </div>
                    {renderGrid(group.rows.slice(0, 8))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {visitedTabs.reviews ? (
            <div className={`storefront-tab-panel ${activeTab === 'reviews' ? 'is-active' : ''}`} hidden={activeTab !== 'reviews'}>
              <div className="storefront-panel">
                <div className="storefront-panel-head">
                  <h2>Đánh giá khách hàng</h2>
                  <span>{reviews.length} đánh giá</span>
                </div>

                {reviews.length === 0 ? (
                  <p className="storefront-empty">Cửa hàng chưa có đánh giá công khai.</p>
                ) : (
                  <div className="storefront-review-list">
                    {reviews.slice(0, 20).map((review) => (
                      <article key={review.id} className="storefront-review-item">
                        <div className="storefront-review-head">
                          <p>{review.productName}</p>
                          <span>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="storefront-review-stars">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star key={`${review.id}-${idx}`} size={14} fill={idx < review.rating ? 'currentColor' : 'none'} />
                          ))}
                        </div>
                        <p className="storefront-review-content">{review.content}</p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default StoreProfilePage;
