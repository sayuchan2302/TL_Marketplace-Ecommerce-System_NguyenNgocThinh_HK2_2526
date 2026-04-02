import { useRef, useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Heart, Eye, Store } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useCartAnimation } from '../../context/CartAnimationContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { productService } from '../../services/productService';
import QuickViewModal from '../QuickViewModal/QuickViewModal';
import { isCanonicalStoreSlug } from '../../utils/storeIdentity';
import './ProductCard.css';

interface ProductCardProps {
  id: number | string;
  sku?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  badge?: string;
  colors?: string[];
  sizes?: string[];
  backendId?: string;
  // Multi-vendor fields
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  isOfficialStore?: boolean;
}

const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

const ProductCard = ({ id, sku, name, price, originalPrice, image, badge, colors, sizes, backendId, storeId, storeName, storeSlug, isOfficialStore }: ProductCardProps) => {
  const discount = originalPrice ? Math.round((1 - price / originalPrice) * 100) : 0;
  const { addToCart } = useCart();
  const { triggerAnimation } = useCartAnimation();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const [addedSize, setAddedSize] = useState<string | null>(null);
  const [selectedColorIdx, setSelectedColorIdx] = useState(0);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const productRouteKey = String(id);
  const isWished = isInWishlist(productRouteKey);

  const availableSizes = sizes ?? DEFAULT_SIZES;
  const selectedColorValue = colors?.[selectedColorIdx] ?? '';
  const hasStoreSlug = isCanonicalStoreSlug(storeSlug);

  const handleSizeClick = async (e: React.MouseEvent, size: string) => {
    e.preventDefault();
    e.stopPropagation();

    const purchaseReference = backendId
      ? { backendProductId: backendId, backendVariantId: undefined }
      : await productService.resolvePurchaseReference(productRouteKey, selectedColorValue || 'Mac dinh', size);

    addToCart({
      id: productRouteKey,
      backendProductId: purchaseReference.backendProductId,
      backendVariantId: purchaseReference.backendVariantId,
      name,
      price,
      originalPrice,
      image,
      color: selectedColorValue || 'Mặc định',
      size,
      storeId: storeId || 'default-store',
      storeName: storeName || 'Cửa hàng',
      isOfficialStore: isOfficialStore || false,
    });

    setAddedSize(size);
    triggerAnimation({
      imgSrc: image,
      imageRect: imageRef.current?.getBoundingClientRect() || null,
      fallbackPoint: { x: e.clientX, y: e.clientY },
    });
    
    setTimeout(() => setAddedSize(null), 1500);
  };

  const handleColorClick = (e: React.MouseEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedColorIdx(idx);
  };

  const handleToggleWishlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isWished) {
      removeFromWishlist(productRouteKey);
    } else {
      triggerAnimation({
        imgSrc: image,
        imageRect: imageRef.current?.getBoundingClientRect() || null,
        fallbackPoint: { x: e.clientX, y: e.clientY },
        target: 'wishlist',
      });
      addToWishlist({
        id: productRouteKey,
        name,
        price,
        originalPrice,
        image,
        storeId,
        storeName,
        isOfficialStore,
      });
    }
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsQuickViewOpen(true);
  };

  return (
    <div className="product-card">
      <div className="product-image-container">
        {/* Wishlist Icon */}
        <button 
          className={`product-wishlist-btn ${isWished ? 'wished' : ''}`}
          onClick={handleToggleWishlist}
          title={isWished ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
          aria-label="Wishlist"
        >
          <Heart size={20} fill={isWished ? "currentColor" : "none"} strokeWidth={isWished ? 1 : 1.5} />
        </button>

        <Link to={`/product/${productRouteKey}`}>
          <img
            ref={imageRef}
            src={image}
            alt={name}
            className="product-image"
            loading="lazy"
            width={672}
            height={990}
          />
          {badge && <span className={`product-badge ${badge === 'SALE' ? 'badge-sale' : ''}`}>{badge}</span>}
          {!badge && discount > 0 && (
            <span className="product-badge badge-sale">-{discount}%</span>
          )}
        </Link>

        {/* Quick View Button */}
        <button 
          className="product-quick-view-btn"
          onClick={handleQuickView}
          title="Xem nhanh"
        >
          <Eye size={18} /> Xem nhanh
        </button>

        {/* Hover Quick-Add Panel */}
        <div className="quick-add-overlay">
          <div className="quick-add-panel">
            <p className="quick-add-label">
              Thêm nhanh vào giỏ hàng <Plus size={14} strokeWidth={2.5} />
            </p>
            <div className="quick-add-sizes">
              {availableSizes.map((size) => (
                <button
                  key={size}
                  className={`quick-size-btn ${addedSize === size ? 'added' : ''}`}
                  onClick={(e) => handleSizeClick(e, size)}
                  title={`Thêm size ${size}`}
                >
                  {addedSize === size ? '✓' : size}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="product-info">
        {/* Color swatches - clickable with ring on selected */}
        {colors && colors.length > 0 && (
          <div className="product-colors">
            {colors.map((color, idx) => (
              <button
                key={idx}
                className={`color-swatch-btn ${selectedColorIdx === idx ? 'selected' : ''}`}
                style={{ '--swatch-color': color } as React.CSSProperties}
                onClick={(e) => handleColorClick(e, idx)}
                aria-label={`Chọn màu ${idx + 1}`}
              >
                <span className="swatch-inner" style={{ backgroundColor: color }}></span>
              </button>
            ))}
          </div>
        )}
         <Link to={`/product/${productRouteKey}`} className="product-name-link">
           <h3 className="product-name">{name}</h3>
         </Link>
         
        <div className="product-prices">
          <span className="current-price">{price.toLocaleString('vi-VN')}đ</span>
          {originalPrice && <span className="original-price">{originalPrice.toLocaleString('vi-VN')}đ</span>}
        </div>

        {(storeName || storeId) && (
          <div className="product-store-attribution">
            <Store size={12} />
            <span className="store-prefix">Bán bởi:</span>
            {hasStoreSlug ? (
              <Link
                to={`/store/${storeSlug}`}
                className="store-link"
                onClick={(e) => e.stopPropagation()}
              >
                <span>{storeName || 'Người bán'}</span>
              </Link>
            ) : (
              <span className="store-link is-disabled">
                <span>{storeName || 'Người bán'}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Quick View Modal */}
      <QuickViewModal
        product={{
          id: productRouteKey,
          backendId,
          sku,
          name,
          price,
          originalPrice,
          image,
          colors,
          sizes,
          storeId,
          storeName,
          isOfficialStore,
        }}
        isOpen={isQuickViewOpen}
        onClose={() => setIsQuickViewOpen(false)}
/>
    </div>
  );
};

function arePropsEqual(prev: ProductCardProps, next: ProductCardProps) {
  return (
    prev.id === next.id &&
    prev.sku === next.sku &&
    prev.name === next.name &&
    prev.price === next.price &&
    prev.originalPrice === next.originalPrice &&
    prev.image === next.image &&
    prev.badge === next.badge &&
    JSON.stringify(prev.colors) === JSON.stringify(next.colors) &&
    JSON.stringify(prev.sizes) === JSON.stringify(next.sizes) &&
    prev.backendId === next.backendId &&
    prev.storeId === next.storeId &&
    prev.storeName === next.storeName &&
    prev.storeSlug === next.storeSlug &&
    prev.isOfficialStore === next.isOfficialStore
  );
}

const ProductCardMemo = memo(ProductCard, arePropsEqual);

export default ProductCardMemo;
