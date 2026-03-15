import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ChevronRight, Check, ShieldCheck, Truck } from 'lucide-react';
import ProductSection from '../../components/ProductSection/ProductSection';
import { mensFashion } from '../Home/Home';
import { useCart } from '../../contexts/CartContext';
import './Cart.css';

const FREE_SHIPPING_THRESHOLD = 500000;

const Cart = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart } = useCart();
  const [selectedItems, setSelectedItems] = useState<string[]>(items.map(i => i.cartId));
  const [couponCode, setCouponCode] = useState('');

  const validSelectedItems = selectedItems.filter(id => items.some(i => i.cartId === id));

  const selectedItemsList = items.filter(item => validSelectedItems.includes(item.cartId));
  const subtotal = selectedItemsList.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalOriginalPrice = selectedItemsList.reduce((sum, item) => sum + (item.originalPrice ?? item.price) * item.quantity, 0);
  const discount = totalOriginalPrice - subtotal;

  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : 30000;
  const total = subtotal + shippingFee;

  const remainingForFreeship = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const freeshipProgress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  const handleQuantityChange = (cartId: string, delta: number) => {
    const item = items.find(i => i.cartId === cartId);
    if (item) updateQuantity(cartId, item.quantity + delta);
  };

  const handleRemoveItem = (cartId: string) => {
    removeFromCart(cartId);
    setSelectedItems(prev => prev.filter(id => id !== cartId));
  };

  const toggleSelectAll = () => {
    if (validSelectedItems.length === items.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(items.map(item => item.cartId));
    }
  };

  const toggleSelectItem = (cartId: string) => {
    if (validSelectedItems.includes(cartId)) {
      setSelectedItems(validSelectedItems.filter(id => id !== cartId));
    } else {
      setSelectedItems([...validSelectedItems, cartId]);
    }
  };

  const formatPrice = (price: number) => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
  };

  if (items.length === 0) {
    return (
      <div className="cart-page">
        <div className="cart-container">
          <h1 className="cart-page-title">Giỏ hàng của bạn</h1>
          <div className="cart-empty-state">
            <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--co-blue)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
            <p>Giỏ hàng của bạn đang trống.</p>
            <Link to="/" className="btn-back-shopping">Tiếp tục mua sắm</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-container">
        {/* Breadcrumb */}
        <nav className="cart-breadcrumb">
          <Link to="/" className="breadcrumb-link">Trang chủ</Link>
          <ChevronRight size={14} />
          <span className="breadcrumb-active">Giỏ hàng ({items.length})</span>
        </nav>

        <h1 className="cart-page-title">Giỏ hàng của bạn</h1>

        <div className="cart-layout">
          {/* ========== LEFT: Items ========== */}
          <div className="cart-left-col">

            {/* Free Shipping Progress */}
            <div className="cart-freeship-banner">
              <div className="freeship-text">
                {remainingForFreeship > 0 ? (
                  <span>Mua thêm <span className="highlight-red">{formatPrice(remainingForFreeship)}</span> để được <strong>Miễn phí vận chuyển</strong></span>
                ) : (
                  <span className="freeship-done"><Check size={16} /> Đơn hàng đã đủ điều kiện <strong>Miễn phí giao hàng</strong></span>
                )}
              </div>
              <div className="progress-track">
                <div className={`progress-fill ${freeshipProgress >= 100 ? 'done' : ''}`} style={{ width: `${freeshipProgress}%` }}></div>
              </div>
            </div>

            {/* Select All Header */}
            <div className="cart-select-header">
              <label className="custom-checkbox-label">
                <input type="checkbox"
                  checked={validSelectedItems.length === items.length && items.length > 0}
                  onChange={toggleSelectAll} />
                <span className="checkbox-icon"></span>
                <span>Chọn tất cả ({items.length} sản phẩm)</span>
              </label>
            </div>

            {/* Cart Items */}
            <div className="cart-items-list">
              {items.map(item => (
                <div className="cart-item-card" key={item.cartId}>
                  <label className="custom-checkbox-label item-cb">
                    <input type="checkbox"
                      checked={validSelectedItems.includes(item.cartId)}
                      onChange={() => toggleSelectItem(item.cartId)} />
                    <span className="checkbox-icon"></span>
                  </label>

                  <Link to={`/product/${item.id}`} className="item-img-link">
                    <img src={item.image} alt={item.name} className="item-img" />
                  </Link>

                  <div className="item-details">
                    <div className="item-top-row">
                      <Link to={`/product/${item.id}`} className="item-name">{item.name}</Link>
                      <button className="btn-remove" onClick={() => handleRemoveItem(item.cartId)} aria-label="Xóa">
                        <Trash2 size={18} />
                      </button>
                    </div>
                    <div className="item-variant">{item.color} / {item.size}</div>
                    <div className="item-bottom-row">
                      <div className="item-prices">
                        <span className="price-current">{formatPrice(item.price)}</span>
                        {item.originalPrice !== undefined && item.originalPrice > item.price && (
                          <span className="price-original">{formatPrice(item.originalPrice)}</span>
                        )}
                      </div>
                      <div className="qty-control">
                        <button className="qty-btn" onClick={() => handleQuantityChange(item.cartId, -1)} disabled={item.quantity <= 1}>−</button>
                        <span className="qty-val">{item.quantity}</span>
                        <button className="qty-btn" onClick={() => handleQuantityChange(item.cartId, 1)}>+</button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ========== RIGHT: Summary ========== */}
          <div className="cart-right-col">
            <div className="cart-summary-card">
              <h2 className="summary-title">Tóm tắt đơn hàng</h2>

              <div className="coupon-row">
                <input type="text" placeholder="Nhập mã giảm giá" value={couponCode}
                  onChange={e => setCouponCode(e.target.value)} className="coupon-input" />
                <button className="btn-apply" disabled={!couponCode.trim()}>Áp dụng</button>
              </div>

              <div className="summary-lines">
                <div className="sum-row">
                  <span>Tạm tính</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="sum-row discount">
                    <span>Giảm giá</span>
                    <span>-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="sum-row">
                  <span>Phí giao hàng</span>
                  <span>{shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}</span>
                </div>
                <div className="sum-divider"></div>
                <div className="sum-row sum-total">
                  <strong>Tổng cộng</strong>
                  <div className="total-block">
                    <strong className="total-big">{formatPrice(total)}</strong>
                    <span className="vat-note">(Đã bao gồm VAT nếu có)</span>
                  </div>
                </div>
              </div>

              <button className="btn-checkout"
                disabled={validSelectedItems.length === 0}
                onClick={() => navigate('/checkout')}>
                TIẾN HÀNH THANH TOÁN
              </button>

              {/* Trust Badges */}
              <div className="trust-badges">
                <div className="badge-box">
                  <ShieldCheck size={22} />
                  <span>Bảo mật thanh toán</span>
                </div>
                <div className="badge-box">
                  <Truck size={22} />
                  <span>Đổi trả miễn phí 60 ngày</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cross-sell */}
        <div className="cart-cross-sell">
          <ProductSection title="SẢN PHẨM BẠN CÓ THỂ THÍCH" products={mensFashion} />
        </div>
      </div>
    </div>
  );
};

export default Cart;
