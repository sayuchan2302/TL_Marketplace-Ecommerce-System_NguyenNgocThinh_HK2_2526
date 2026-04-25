import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronRight, Star, Store, MessageSquare } from 'lucide-react';
import ProductGallery from '../../components/ProductGallery/ProductGallery';
import ProductInfo from '../../components/ProductInfo/ProductInfo';
import ProductActions from '../../components/ProductActions/ProductActions';
import ProductDescription from '../../components/ProductDescription/ProductDescription';
import ProductDetailSkeleton from '../../components/ProductDetailSkeleton/ProductDetailSkeleton';
import StoreInfoCard from '../../components/StoreInfoCard/StoreInfoCard';
import { productService } from '../../services/productService';
import { reviewService } from '../../services/reviewService';
import { CLIENT_TEXT } from '../../utils/texts';
import { CLIENT_DICTIONARY } from '../../utils/clientDictionary';
import type { Product } from '../../types';
import { normalizeStoreSlug } from '../../utils/storeIdentity';
import './ProductDetail.css';

interface ClientReviewItem {
  id: string;
  rating: number;
  content: string;
  reply?: string;
  createdAt: string;
  status?: string;
}

const t = CLIENT_TEXT.productDetail;

const renderRating = (value: number) => (
  <div className="pdp-review-stars" aria-label={`Rating ${value} out of 5`}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        size={16}
        fill={value >= star ? 'currentColor' : 'none'}
        stroke={value >= star ? 'currentColor' : 'var(--co-gray-300)'}
        className={value >= star ? 'pdp-review-star-active' : 'pdp-review-star'}
      />
    ))}
  </div>
);

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [reviews, setReviews] = useState<ClientReviewItem[]>([]);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');

  const productId = id || '';
  const storeSlug = normalizeStoreSlug(product?.storeSlug);

  useEffect(() => {
    window.scrollTo(0, 0);
    let isMounted = true;

    const timer = setTimeout(() => {
      void (async () => {
        const fetched = (await productService.getByIdentifier(productId)) || productService.list()[0] || null;
        if (!isMounted) {
          return;
        }

        setProduct(fetched);

        if (fetched) {
          const defaultVariant = fetched.variants?.[0];
          setSelectedColor(defaultVariant?.color || fetched.colors?.[0] || '');
          setSelectedSize(defaultVariant?.size || '');
        }

        const backendProductId = fetched?.backendId || '';
        if (!backendProductId) {
          setReviews([]);
          setIsLoading(false);
          return;
        }

        try {
          const productReviews = await reviewService.getReviewsByProduct(backendProductId);

          if (!isMounted) {
            return;
          }

          setReviews(productReviews);
        } catch {
          if (!isMounted) {
            return;
          }

          setReviews([]);
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      })();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [productId]);
  const averageRating =
    reviews.length > 0 ? Number((reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)) : null;

  if (isLoading || !product) {
    return (
      <div className="pdp-page">
        <div className="container pdp-container">
          <ProductDetailSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="pdp-page">
      <div className="breadcrumb-wrapper">
        <div className="container">
          <nav className="breadcrumbs">
            <Link to="/" className="breadcrumb-link">
              {CLIENT_TEXT.common.breadcrumb.home}
            </Link>
            <ChevronRight size={14} className="breadcrumb-separator" />
            <Link to={`/category/${product.category || 'all'}`} className="breadcrumb-link">
              {product.category || CLIENT_TEXT.productListing.title}
            </Link>
            <ChevronRight size={14} className="breadcrumb-separator" />
            <span className="breadcrumb-current">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container pdp-container">
        <div className="pdp-top-section">
          <div className="pdp-gallery-col">
            <ProductGallery images={product.images && product.images.length > 0 ? product.images : [product.image]} />

            {storeSlug && (
              <StoreInfoCard
                storeId={product.storeId}
                storeName={product.storeName || 'Cửa hàng'}
                storeSlug={storeSlug}
                storeLogo={product.storeLogo}
                isOfficialStore={product.isOfficialStore}
              />
            )}
          </div>

          <div className="pdp-info-col">
            <ProductInfo
              product={product}
              averageRating={averageRating}
              reviewCount={reviews.length}
              onVariantChange={(color, size) => {
                setSelectedColor(color);
                setSelectedSize(size);
              }}
            />
            <ProductActions
              product={{
                id: product.sku,
                backendId: product.backendId,
                name: product.name,
                price: product.price,
                originalPrice: product.originalPrice,
                image: product.image,
                storeId: product.storeId,
                storeName: product.storeName,
                isOfficialStore: product.isOfficialStore,
              }}
              selectedColor={selectedColor}
              selectedSize={selectedSize}
            />
            <div className="pdp-review-summary">
              {averageRating !== null && (
                <div className="pdp-review-avg">
                  <Star size={15} fill="currentColor" className="pdp-star-filled" />
                  <span className="pdp-avg-value">{averageRating.toFixed(1)}</span>
                </div>
              )}
              <span className="pdp-review-count">
                {reviews.length} {CLIENT_DICTIONARY.reviews.countLabel}
              </span>
            </div>
            <div className="pd-size-help">
              <p className="pd-size-text">{t.sizeHelp.text}</p>
              <div className="pd-size-links">
                <Link to="/size-guide" className="pd-size-link">
                  {t.sizeHelp.sizeGuide}
                </Link>
                <Link to="/contact" className="pd-size-link">
                  {t.sizeHelp.consult}
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="pdp-bottom-section">
          <ProductDescription product={product} />

          <div className="pdp-reviews-section">
            <div className="pdp-reviews-header">
              <div className="pdp-reviews-title-row">
                <h3 className="pdp-reviews-title">{CLIENT_DICTIONARY.reviews.title}</h3>
                {averageRating !== null && (
                  <div className="pdp-rating-chip">
                    <Star size={14} fill="currentColor" />
                    {averageRating.toFixed(1)} / 5
                  </div>
                )}
              </div>
              <span className="pdp-reviews-badge">
                {reviews.length} {CLIENT_DICTIONARY.reviews.countLabel}
              </span>
            </div>

            {reviews.length === 0 ? (
              <div className="pdp-reviews-empty">
                <MessageSquare size={32} strokeWidth={1.5} />
                <p>{CLIENT_DICTIONARY.reviews.empty}</p>
              </div>
            ) : (
              <div className="pdp-reviews-list">
                {reviews.map((review) => (
                  <div key={review.id} className="pdp-review-card">
                    <div className="pdp-review-top">
                      {renderRating(review.rating)}
                      <span className="pdp-review-date">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <p className="pdp-review-content">{review.content}</p>
                    {review.reply && (
                      <div className="pdp-review-reply">
                        <span className="pdp-review-reply-label">
                          <Store size={11} />
                          {CLIENT_DICTIONARY.reviews.replyBadge}
                        </span>
                        <p className="pdp-review-reply-text">{review.reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProductDetail;

