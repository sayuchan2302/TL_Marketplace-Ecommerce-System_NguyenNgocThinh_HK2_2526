import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart, ChevronRight, X } from 'lucide-react';
import { useWishlist } from '../../contexts/WishlistContext';
import { useCart } from '../../contexts/CartContext';
import { useCartAnimation } from '../../context/CartAnimationContext';
import { productService } from '../../services/productService';
import { formatPrice } from '../../utils/formatters';
import ProductCard from '../../components/ProductCard/ProductCard';
import './Wishlist.css';

const AVAILABLE_SIZES = ['S', 'M', 'L', 'XL', '2XL'];
const AVAILABLE_COLORS = ['Đen', 'Trắng', 'Xanh Navy', 'Xám'];

interface PendingItem {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  storeId?: string;
  storeName?: string;
  isOfficialStore?: boolean;
}

const Wishlist = () => {
  const { items, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const { triggerAnimation } = useCartAnimation();

  const [pendingItem, setPendingItem] = useState<PendingItem | null>(null);
  const [selectedSize, setSelectedSize] = useState('M');
  const [selectedColor, setSelectedColor] = useState('Đen');

  const openVariantModal = (item: typeof items[0]) => {
    setPendingItem(item);
    setSelectedSize('M');
    setSelectedColor('Đen');
  };

  const handleConfirmAddToCart = async (e: React.MouseEvent) => {
    if (!pendingItem) return;
    
    // Tìm element ảnh để lấy toạ độ ban đầu (nếu có)
    const imgEl = document.querySelector('.wl-modal-img') as HTMLImageElement | null;
    const purchaseReference = await productService.resolvePurchaseReference(
      String(pendingItem.id),
      selectedColor,
      selectedSize,
    );
    
    addToCart({
      id: pendingItem.id,
      backendProductId: purchaseReference.backendProductId,
      backendVariantId: purchaseReference.backendVariantId,
      name: pendingItem.name,
      price: pendingItem.price,
      image: pendingItem.image,
      color: selectedColor,
      size: selectedSize,
      storeId: pendingItem.storeId,
      storeName: pendingItem.storeName,
      isOfficialStore: pendingItem.isOfficialStore,
    });
    
    triggerAnimation({
      imgSrc: pendingItem.image,
      imageRect: imgEl?.getBoundingClientRect() || null,
      fallbackPoint: { x: e.clientX, y: e.clientY }
    });
    
    removeFromWishlist(pendingItem.id);
    setPendingItem(null);
  };

  return (
    <div className="wishlist-page">
      <div className="wishlist-container">
        {/* Breadcrumb */}
        <div className="wishlist-breadcrumb">
          <Link to="/">Trang chủ</Link>
          <ChevronRight size={14} />
          <span>Yêu thích</span>
        </div>

        <h1 className="wishlist-title">
          <Heart size={24} fill="var(--co-blue)" color="var(--co-blue)" />
          Sản phẩm yêu thích ({items.length})
        </h1>

        {items.length === 0 ? (
          <div className="wishlist-empty">
            <Heart size={80} strokeWidth={1} />
            <h2>Danh sách yêu thích trống</h2>
            <p>Hãy thêm những sản phẩm bạn yêu thích bằng cách nhấn vào biểu tượng <Heart size={16} fill="var(--co-blue)" color="var(--co-blue)" style={{ verticalAlign: 'middle' }} /> trên sản phẩm.</p>
            <Link to="/" className="wishlist-shop-btn">Khám phá sản phẩm</Link>
          </div>
        ) : (
          <div className="wishlist-grid">
            {items.map(item => (
              <div key={item.id} className="wishlist-grid-item">
                <ProductCard
                  id={item.id}
                  name={item.name}
                  price={item.price}
                  originalPrice={item.originalPrice}
                  image={item.image}
                  storeId={item.storeId}
                  storeName={item.storeName}
                  isOfficialStore={item.isOfficialStore}
                  staticMode
                  onQuickAdd={() => openVariantModal(item)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Variant Selection Modal */}
      {pendingItem && (
        <div className="wl-modal-overlay" onClick={() => setPendingItem(null)}>
          <div className="wl-modal" onClick={e => e.stopPropagation()}>
            <button className="wl-modal-close" onClick={() => setPendingItem(null)}>
              <X size={20} />
            </button>

            <div className="wl-modal-product">
              <img src={pendingItem.image} alt={pendingItem.name} className="wl-modal-img" />
              <div>
                <p className="wl-modal-name">{pendingItem.name}</p>
                <p className="wl-modal-price">{formatPrice(pendingItem.price)}</p>
              </div>
            </div>

            <div className="wl-variant-section">
              <p className="wl-variant-label">Màu sắc: <strong>{selectedColor}</strong></p>
              <div className="wl-option-group">
                {AVAILABLE_COLORS.map(color => (
                  <button
                    key={color}
                    className={`wl-option-btn ${selectedColor === color ? 'active' : ''}`}
                    onClick={() => setSelectedColor(color)}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div className="wl-variant-section">
              <p className="wl-variant-label">Kích thước: <strong>{selectedSize}</strong></p>
              <div className="wl-option-group">
                {AVAILABLE_SIZES.map(size => (
                  <button
                    key={size}
                    className={`wl-option-btn ${selectedSize === size ? 'active' : ''}`}
                    onClick={() => setSelectedSize(size)}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <button className="wl-confirm-btn" onClick={handleConfirmAddToCart}>
              <ShoppingCart size={18} />
              Thêm vào giỏ hàng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wishlist;
