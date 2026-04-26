import { memo, type ReactNode } from 'react';
import { Star, TicketPercent } from 'lucide-react';
import ProductCard from '../../../components/ProductCard/ProductCard';
import type { Coupon } from '../../../services/couponService';
import type { Review } from '../../../services/reviewService';
import type { StoreProduct } from '../../../services/storeService';

export type PaginationToken = number | 'ellipsis-left' | 'ellipsis-right';

const formatCurrency = (value: number) => `${Math.max(0, Number(value || 0)).toLocaleString('vi-VN')}\u0111`;

const getProductLink = (product: StoreProduct) => product.slug || product.sku || String(product.id);

interface StoreProductCardProps {
  product: StoreProduct;
  storeName: string;
}

interface StorefrontProductGridProps {
  rows: StoreProduct[];
  storeName: string;
  emptyMessage?: string;
}

export interface BrowseTabContentProps {
  vouchers: Coupon[];
  isAuthenticated: boolean;
  claimedVoucherIds: Set<string>;
  claimingVoucherId: string | null;
  onClaimVoucher: (voucher: Coupon) => void;
  storeName: string;
  bannerUrl: string;
  topSellingProducts: StoreProduct[];
}

export interface ProductsTabContentProps {
  productTotal: number;
  productPage: number;
  productTotalPages: number;
  productPageItems: StoreProduct[];
  productPageLoading: boolean;
  paginationTokens: PaginationToken[];
  storeName: string;
  onPageChange: (nextPage: number) => void;
}

export interface CategoriesTabContentProps {
  categoryLoading: boolean;
  groupedByCategory: Array<{ name: string; rows: StoreProduct[] }>;
}

export interface ReviewsTabContentProps {
  reviews: Review[];
}

export interface StorefrontTabPanelProps {
  active: boolean;
  panelRef: (node: HTMLDivElement | null) => void;
  children: ReactNode;
}

const StoreProductCard = memo(({ product, storeName }: StoreProductCardProps) => (
  <ProductCard
    id={getProductLink(product)}
    sku={product.sku}
    name={product.name}
    price={product.price}
    originalPrice={product.originalPrice}
    image={product.image}
    badge={product.badge}
    colors={product.colors}
    sizes={product.sizes}
    variants={product.variants}
    backendId={product.backendId}
    storeId={product.storeId}
    storeName={product.storeName || storeName}
    storeSlug={product.storeSlug}
    isOfficialStore={product.isOfficialStore}
  />
));
StoreProductCard.displayName = 'StoreProductCard';

const StorefrontProductGrid = memo(({
  rows,
  storeName,
  emptyMessage = 'Hi\u1ec7n ch\u01b0a c\u00f3 s\u1ea3n ph\u1ea9m c\u00f4ng khai.',
}: StorefrontProductGridProps) => {
  if (rows.length === 0) {
    return <p className="storefront-empty">{emptyMessage}</p>;
  }

  return (
    <div className="storefront-grid">
      {rows.map((product) => (
        <div key={`${product.id}-${product.sku}`} className="grid-item">
          <StoreProductCard product={product} storeName={storeName} />
        </div>
      ))}
    </div>
  );
});
StorefrontProductGrid.displayName = 'StorefrontProductGrid';

export const BrowseTabContent = memo(({
  vouchers,
  isAuthenticated,
  claimedVoucherIds,
  claimingVoucherId,
  onClaimVoucher,
  storeName,
  bannerUrl,
  topSellingProducts,
}: BrowseTabContentProps) => (
  <>
    <div className="storefront-panel">
      <h2>Voucher c\u1eeda h\u00e0ng</h2>
      {vouchers.length === 0 ? (
        <p className="storefront-empty">Hi\u1ec7n ch\u01b0a c\u00f3 voucher c\u00f4ng khai cho gian h\u00e0ng n\u00e0y.</p>
      ) : (
        <div className="storefront-voucher-list">
          {vouchers.slice(0, 10).map((voucher) => {
            const voucherId = String(voucher.id || '').trim();
            const isClaimed = voucherId ? claimedVoucherIds.has(voucherId) : false;
            const isClaiming = voucherId !== '' && claimingVoucherId === voucherId;
            const claimLabel = !isAuthenticated
              ? '\u0110\u0103ng nh\u1eadp \u0111\u1ec3 nh\u1eadn'
              : isClaiming
                ? '\u0110ang nh\u1eadn...'
                : isClaimed
                  ? '\u0110\u00e3 nh\u1eadn'
                  : 'Nh\u1eadn';

            return (
              <article key={voucher.id || voucher.code} className="storefront-voucher">
                <div className="storefront-voucher-cut storefront-voucher-cut-left" />
                <div className="storefront-voucher-cut storefront-voucher-cut-right" />
                <div className="storefront-voucher-content">
                  <div>
                    <p className="storefront-voucher-code">{voucher.code}</p>
                    <p className="storefront-voucher-text">
                      {voucher.type === 'percent'
                        ? `Gi\u1ea3m ${voucher.value}%`
                        : `Gi\u1ea3m ${formatCurrency(voucher.value)}`}
                    </p>
                    <p className="storefront-voucher-meta">
                      \u0110\u01a1n t\u1ed1i thi\u1ec3u {formatCurrency(voucher.minOrderValue || 0)}
                    </p>
                  </div>
                  <TicketPercent size={18} />
                </div>
                <div className="storefront-voucher-actions">
                  <button
                    type="button"
                    className={`storefront-voucher-claim ${isClaimed ? 'is-claimed' : ''}`}
                    disabled={isClaiming || isClaimed || !voucherId}
                    onClick={() => onClaimVoucher(voucher)}
                  >
                    {claimLabel}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>

    <div className="storefront-panel storefront-campaign">
      <img
        src={bannerUrl}
        alt={storeName}
        className="storefront-campaign-image"
        loading="lazy"
      />
      <div className="storefront-campaign-overlay" />
      <div className="storefront-campaign-content">
        <p>Campaign</p>
        <h3>\u01afu \u0111\u00e3i n\u1ed5i b\u1eadt t\u1ea1i {storeName}</h3>
        <span>Mua s\u1eafm an t\u00e2m v\u1edbi ch\u00ednh s\u00e1ch b\u1ea3o v\u1ec7 t\u1eeb s\u00e0n.</span>
      </div>
    </div>

    <div className="storefront-panel">
      <div className="storefront-panel-head">
        <h2>S\u1ea3n ph\u1ea9m \u0111\u01b0\u1ee3c quan t\u00e2m</h2>
        <span>{topSellingProducts.length} s\u1ea3n ph\u1ea9m</span>
      </div>
      <StorefrontProductGrid rows={topSellingProducts} storeName={storeName} />
    </div>
  </>
));
BrowseTabContent.displayName = 'BrowseTabContent';

export const ProductsTabContent = memo(({
  productTotal,
  productPage,
  productTotalPages,
  productPageItems,
  productPageLoading,
  paginationTokens,
  storeName,
  onPageChange,
}: ProductsTabContentProps) => (
  <div className="storefront-panel">
    <div className="storefront-panel-head">
      <h2>T\u1ea5t c\u1ea3 s\u1ea3n ph\u1ea9m</h2>
      <span>{productTotal} s\u1ea3n ph\u1ea9m</span>
    </div>
    <StorefrontProductGrid rows={productPageItems} storeName={storeName} />
    <p className="storefront-page-summary">
      Trang {productPage}/{productTotalPages} - {productTotal} s\u1ea3n ph\u1ea9m
      {productPageLoading ? ' - \u0110ang t\u1ea3i...' : ''}
    </p>
    {productTotalPages > 1 ? (
      <div className="storefront-pagination">
        <button
          type="button"
          className="storefront-page-btn"
          onClick={() => onPageChange(Math.max(1, productPage - 1))}
          disabled={productPageLoading || productPage === 1}
        >
          Tr\u01b0\u1edbc
        </button>
        <div className="storefront-page-list" aria-label="Pagination">
          {paginationTokens.map((token) => (
            typeof token === 'number' ? (
              <button
                key={token}
                type="button"
                className={`storefront-page-btn ${productPage === token ? 'is-active' : ''}`}
                onClick={() => onPageChange(token)}
                disabled={productPageLoading}
                aria-current={productPage === token ? 'page' : undefined}
              >
                {token}
              </button>
            ) : (
              <span key={token} className="storefront-page-ellipsis" aria-hidden="true">
                ...
              </span>
            )
          ))}
        </div>
        <button
          type="button"
          className="storefront-page-btn"
          onClick={() => onPageChange(Math.min(productTotalPages, productPage + 1))}
          disabled={productPageLoading || productPage === productTotalPages}
        >
          Sau
        </button>
      </div>
    ) : null}
  </div>
));
ProductsTabContent.displayName = 'ProductsTabContent';

export const CategoriesTabContent = memo(({
  categoryLoading,
  groupedByCategory,
}: CategoriesTabContentProps) => (
  <div className="storefront-panel">
    <div className="storefront-panel-head">
      <h2>Danh m\u1ee5c c\u1ee7a c\u1eeda h\u00e0ng</h2>
      <span>{groupedByCategory.length} danh m\u1ee5c</span>
    </div>
    {categoryLoading ? (
      <p className="storefront-empty">\u0110ang t\u1ea3i danh m\u1ee5c...</p>
    ) : groupedByCategory.length === 0 ? (
      <p className="storefront-empty">Hi\u1ec7n ch\u01b0a c\u00f3 danh m\u1ee5c c\u00f3 s\u1ea3n ph\u1ea9m.</p>
    ) : (
      <div className="storefront-category-list">
        {groupedByCategory.map((group) => (
          <div key={group.name} className="storefront-category-item">
            <p className="storefront-category-name">{group.name}</p>
            <span className="storefront-category-count">{group.rows.length} s\u1ea3n ph\u1ea9m</span>
          </div>
        ))}
      </div>
    )}
  </div>
));
CategoriesTabContent.displayName = 'CategoriesTabContent';

export const ReviewsTabContent = memo(({ reviews }: ReviewsTabContentProps) => (
  <div className="storefront-panel">
    <div className="storefront-panel-head">
      <h2>\u0110\u00e1nh gi\u00e1 kh\u00e1ch h\u00e0ng</h2>
      <span>{reviews.length} \u0111\u00e1nh gi\u00e1</span>
    </div>

    {reviews.length === 0 ? (
      <p className="storefront-empty">C\u1eeda h\u00e0ng ch\u01b0a c\u00f3 \u0111\u00e1nh gi\u00e1 c\u00f4ng khai.</p>
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
));
ReviewsTabContent.displayName = 'ReviewsTabContent';

export const StorefrontTabPanel = ({ active, panelRef, children }: StorefrontTabPanelProps) => (
  <div
    ref={panelRef}
    className={`storefront-tab-panel ${active ? 'is-active' : ''}`}
    aria-hidden={!active}
  >
    {children}
  </div>
);
