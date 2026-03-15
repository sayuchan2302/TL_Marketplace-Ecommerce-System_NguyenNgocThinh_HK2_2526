import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Check, Wallet, Banknote, Loader2, Trash2, X } from 'lucide-react';
import './Checkout.css';
import { useCart } from '../../contexts/CartContext';
import AddressBookModal from './AddressBookModal';

interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  district?: string;
  ward?: string;
  note?: string;
}

const Checkout = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'zalopay' | 'momo' | 'vnpay'>('vnpay');
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formValues, setFormValues] = useState({
    name: 'Anh Thịnh', phone: '0382253049', email: 'thinh23022004@gmail.com',
    address: 'JJJV+Q7F, Quốc lộ 37, Đại Từ, Thái Nguyên',
    city: 'Thái Nguyên', district: 'Huyện Đại Từ', ward: 'Thị trấn Hùng Sơn', note: ''
  });

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const handleQuantityChange = (cartId: string, delta: number) => {
    const item = items.find(i => i.cartId === cartId);
    if (item) {
      const newQty = item.quantity + delta;
      if (newQty > 0) updateQuantity(cartId, newQty);
    }
  };

  const handleRemoveItem = (cartId: string) => {
    removeFromCart(cartId);
  };

  // All cart items go to checkout — selection was done on Cart page
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = subtotal > 200000 ? 0 : 30000;
  const total = subtotal + shippingFee;

  const handleAddressSelect = (addr: any) => {
    setFormValues(prev => ({
      ...prev, name: addr.name, phone: addr.phone, address: addr.address,
      ward: addr.ward, district: addr.district, city: addr.city,
    }));
    setFormErrors({});
  };

  const validate = (): FormErrors => {
    const errors: FormErrors = {};
    if (!formValues.name.trim()) errors.name = 'Vui lòng nhập họ và tên';
    if (!formValues.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^(0[3|5|7|8|9])+([0-9]{8})$/.test(formValues.phone.trim())) errors.phone = 'Số điện thoại không hợp lệ';
    if (!formValues.address.trim()) errors.address = 'Vui lòng nhập địa chỉ chi tiết';
    if (!formValues.city) errors.city = 'Vui lòng nhập tỉnh / thành phố';
    if (!formValues.district) errors.district = 'Vui lòng nhập quận / huyện';
    if (!formValues.ward) errors.ward = 'Vui lòng nhập phường / xã';
    return errors;
  };

  const handleFieldChange = (field: keyof FormErrors | 'email' | 'note', value: string) => {
    setFormValues(prev => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsSuccessModalOpen(true);
      // Clear all items after successful order
      items.forEach(item => removeFromCart(item.cartId));
    }, 1500);
  };

  const formatPrice = (price: number) => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
  };

  const handleBackToHome = () => {
    setIsSuccessModalOpen(false);
    navigate('/');
  };

  return (
    <div className="checkout-page-container">
      <div className="checkout-main-content">
        <div className="checkout-container">

          {/* Breadcrumb */}
          <div className="checkout-breadcrumb">
            <Link to="/cart" className="breadcrumb-link">Giỏ hàng</Link>
            <ChevronRight size={14} />
            <span className="breadcrumb-active">Thông tin giao hàng</span>
            <ChevronRight size={14} />
            <span className="breadcrumb-inactive">Thanh toán</span>
          </div>

          <div className="checkout-layout">
            {/* ========== LEFT COLUMN ========== */}
            <div className="checkout-left-col">

              {/* Shipping Info */}
              <section className="checkout-section">
                <div className="section-header-flex">
                  <h2 className="checkout-section-title">Thông tin giao hàng</h2>
                  <button className="address-book-toggle-btn" onClick={() => setIsAddressModalOpen(true)}>
                    Chọn từ sổ địa chỉ <ChevronRight size={16} />
                  </button>
                </div>

                <div className="form-grid">
                  <div className="form-group col-span-2">
                    <label className="input-label">Họ Tên</label>
                    <div className="input-with-prefix">
                      <select className="prefix-select">
                        <option value="anh">Anh</option>
                        <option value="chi">Chị</option>
                      </select>
                      <input
                        type="text"
                        className={`checkout-input ${formErrors.name ? 'input-error' : ''}`}
                        placeholder="Họ Tên đệm và Tên"
                        value={formValues.name}
                        onChange={e => handleFieldChange('name', e.target.value)}
                      />
                    </div>
                    {formErrors.name && <span className="field-error">{formErrors.name}</span>}
                  </div>

                  <div className="form-group col-span-1">
                    <label className="input-label">SDT</label>
                    <input
                      type="tel"
                      className={`checkout-input ${formErrors.phone ? 'input-error' : ''}`}
                      placeholder="Số điện thoại"
                      value={formValues.phone}
                      onChange={e => handleFieldChange('phone', e.target.value)}
                    />
                    {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                  </div>

                  <div className="form-group col-span-1">
                    <label className="input-label">Email</label>
                    <input
                      type="email"
                      className="checkout-input"
                      placeholder="Email (Không bắt buộc)"
                      value={formValues.email}
                      onChange={e => handleFieldChange('email', e.target.value)}
                    />
                  </div>

                  <div className="form-group col-span-2">
                    <label className="input-label">Địa chỉ</label>
                    <input
                      type="text"
                      className={`checkout-input ${formErrors.address ? 'input-error' : ''}`}
                      value={formValues.address}
                      onChange={e => handleFieldChange('address', e.target.value)}
                    />
                    {formErrors.address && <span className="field-error">{formErrors.address}</span>}
                  </div>

                  <div className="form-group col-span-1">
                    <input type="text" className={`checkout-input ${formErrors.city ? 'input-error' : ''}`}
                      placeholder="Tỉnh/Thành phố" value={formValues.city}
                      onChange={e => handleFieldChange('city', e.target.value)} />
                  </div>
                  <div className="form-group col-span-1">
                    <input type="text" className={`checkout-input ${formErrors.district ? 'input-error' : ''}`}
                      placeholder="Quận/Huyện" value={formValues.district}
                      onChange={e => handleFieldChange('district', e.target.value)} />
                  </div>
                  <div className="form-group col-span-1">
                    <input type="text" className={`checkout-input ${formErrors.ward ? 'input-error' : ''}`}
                      placeholder="Phường/Xã" value={formValues.ward}
                      onChange={e => handleFieldChange('ward', e.target.value)} />
                  </div>

                  <div className="form-group col-span-2">
                    <label className="input-label">Ghi chú</label>
                    <input type="text" className="checkout-input" placeholder="Nhập ghi chú"
                      value={formValues.note} onChange={e => handleFieldChange('note', e.target.value)} />
                  </div>
                </div>


              </section>

              {/* Payment Methods */}
              <section className="checkout-section">
                <h2 className="checkout-section-title">Hình thức thanh toán</h2>
                <div className="payment-options-list">

                  <label className={`payment-card ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                    <span className="radio-circle"></span>
                    <div className="payment-info payment-col">
                      <div className="payment-row">
                        <img src="https://mcdn.coolmate.me/image/October2024/mceclip2_42.png" alt="COD" className="payment-icon" />
                        <div>
                          <span className="payment-name-text">Thanh toán khi nhận hàng</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className={`payment-card ${paymentMethod === 'zalopay' ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value="zalopay" checked={paymentMethod === 'zalopay'} onChange={() => setPaymentMethod('zalopay')} />
                    <span className="radio-circle"></span>
                    <div className="payment-info payment-col">
                      <div className="payment-row">
                        <img src="https://mcdn.coolmate.me/image/October2024/mceclip3_6.png" alt="ZaloPay" className="payment-icon" />
                        <div>
                          <span className="payment-name-text">Thanh toán qua Zalopay</span>
                          <span className="payment-sub-text">Hỗ trợ mọi hình thức thanh toán</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className={`payment-card ${paymentMethod === 'momo' ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value="momo" checked={paymentMethod === 'momo'} onChange={() => setPaymentMethod('momo')} />
                    <span className="radio-circle"></span>
                    <div className="payment-info payment-col">
                      <div className="payment-row">
                        <img src="https://mcdn.coolmate.me/image/October2024/mceclip1_171.png" alt="MoMo" className="payment-icon" />
                        <div>
                          <span className="payment-name-text">Ví điện tử MoMo</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className={`payment-card ${paymentMethod === 'vnpay' ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value="vnpay" checked={paymentMethod === 'vnpay'} onChange={() => setPaymentMethod('vnpay')} />
                    <span className="radio-circle"></span>
                    <div className="payment-info payment-col">
                      <div className="payment-row">
                        <img src="https://mcdn.coolmate.me/image/October2024/mceclip0_81.png" alt="VNPay" className="payment-icon" />
                        <div>
                          <span className="payment-name-text">VNPAY / TháiQR</span>
                          <span className="vnpay-promo-badge">Mã "VNPAYCOOL" giảm 10% (tối đa 150k)</span>
                        </div>
                      </div>
                    </div>
                  </label>

                </div>
                <div className="payment-return-policy">
                  Nếu bạn không hài lòng với sản phẩm? Bạn hoàn toàn có thể trả lại sản phẩm. Tìm hiểu thêm <Link to="#">tại đây</Link>.
                </div>
              </section>
            </div>

            {/* ========== RIGHT COLUMN ========== */}
            <div className="checkout-right-col">
              <div className="checkout-summary-wrapper">

                {/* Freeship Alert */}
                <div className="freeship-alert">
                  <Check size={18} /> Đơn hàng đã được Miễn phí vận chuyển
                </div>

                {/* Cart Header */}
                <div className="cart-header-actions">
                  <span className="cart-item-count">Đơn hàng ({items.length} sản phẩm)</span>
                </div>

                {/* Cart Items */}
                <div className="unified-cart-list">
                  {items.length === 0 ? (
                    <div className="empty-cart-msg">Chưa có sản phẩm nào</div>
                  ) : (
                    items.map(item => (
                      <div className="unified-cart-item" key={item.cartId}>
                        <img src="https://vi.saigontourist.net/vsgt-images/17/202111/bai-viet-c8205f25-cecb-4467-9bb3-55914fa6443c.jpeg"
                          alt={item.name} className="unified-item-img" />

                        <div className="unified-item-info">
                          <Link to={`/product/${item.id}`} className="unified-item-name">{item.name}</Link>
                          <div className="variant-selectors">
                            <div className="fake-select">{item.color} <ChevronRight size={14} /></div>
                            <div className="fake-select">{item.size} <ChevronRight size={14} /></div>
                          </div>
                          <button className="unified-item-remove" onClick={() => handleRemoveItem(item.cartId)}>
                            <Trash2 size={14} /> Xóa
                          </button>
                        </div>

                        <div className="unified-qty-price">
                          <div className="unified-qty-control">
                            <button onClick={() => handleQuantityChange(item.cartId, -1)} disabled={item.quantity <= 1}>−</button>
                            <span>{item.quantity}</span>
                            <button onClick={() => handleQuantityChange(item.cartId, 1)}>+</button>
                          </div>
                          <div className="unified-item-price">{formatPrice(item.price)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Social Proof */}
                <div className="social-proof-alert">
                  Có <b>6 người</b> đang thêm cùng sản phẩm giống bạn vào giỏ hàng.
                </div>

                {/* Coupon Tickets */}
                <div className="coupon-ticket-scroll">
                  <div className="coupon-ticket">
                    <div className="ticket-info">
                      <strong>WELCOMEJ7BMF6</strong> (Còn 1)<br/>
                      <span className="ticket-desc">Giảm 15% tối đa 50k cho đơn bất kỳ</span>
                      <div className="ticket-expiry">HSD: 12/04/2026</div>
                    </div>
                    <div className="ticket-action">
                      <div className="ticket-radio"></div>
                      <a href="#" className="ticket-link">Điều kiện</a>
                    </div>
                  </div>
                  <div className="coupon-ticket coupon-faded">
                    <div className="ticket-info">
                      <strong>NHNS153</strong> (Còn 21)<br/>
                      <span className="ticket-desc">Giảm 15.3% tối đa 200k</span>
                    </div>
                  </div>
                </div>

                {/* Voucher Input */}
                <div className="checkout-coupon-box">
                  <button className="btn-wallet-voucher">
                    <Wallet size={16} /> Ví Voucher
                  </button>
                  <div className="input-group-row">
                    <input type="text" placeholder="Nhập mã giảm giá" className="checkout-input coupon-input" />
                    <button className="btn-dark-apply">ÁP DỤNG</button>
                  </div>
                </div>

                {/* Order Calculations */}
                <div className="checkout-calculations">
                  <h3 className="calc-title">Chi tiết thanh toán</h3>

                  <div className="calc-row">
                    <span className="calc-label">Tổng giá trị sản phẩm</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  <div className="calc-row">
                    <span className="calc-label">Phí giao hàng</span>
                    <span>{shippingFee === 0 ? 'Miễn phí' : formatPrice(shippingFee)}</span>
                  </div>



                  <div className="calc-row calc-total">
                    <strong>Thành tiền</strong>
                    <div className="total-value-block">
                      <strong className="total-price-big">{formatPrice(total)}</strong>
                      <div className="vat-note">(Đã bao gồm VAT nếu có)</div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* ========== BOTTOM STICKY BAR ========== */}
          <div className="bottom-sticky-bar">
            <div className="bottom-bar-inner">
              {/* Left: light blue tint */}
              <div className="bottom-bar-left">
                <div className="bar-left-content">
                  <div className="payment-method-indicator">
                    {paymentMethod === 'vnpay' && <><img src="https://mcdn.coolmate.me/image/October2024/mceclip0_81.png" alt="VNPAY" className="payment-icon-img" /><strong>VNPAY / TháiQR</strong></>}
                    {paymentMethod === 'zalopay' && <><img src="https://mcdn.coolmate.me/image/October2024/mceclip3_6.png" alt="ZaloPay" className="payment-icon-img" /><strong>Thanh toán qua Zalopay</strong></>}
                    {paymentMethod === 'momo' && <><img src="https://mcdn.coolmate.me/image/October2024/mceclip1_171.png" alt="MoMo" className="payment-icon-img" /><strong>Ví điện tử MoMo</strong></>}
                    {paymentMethod === 'cod' && <><img src="https://mcdn.coolmate.me/image/October2024/mceclip2_42.png" alt="COD" className="payment-icon-img" /><strong>Thanh toán khi nhận hàng</strong></>}
                  </div>
                  <div className="bar-divider"></div>
                  <div className="voucher-indicator">
                    <img src="https://n7media.coolmate.me/uploads/March2024/voucher-logo-mb.png?aio=w-300" alt="Voucher" className="voucher-icon-img" />
                    <span>Voucher</span>
                  </div>
                </div>
              </div>

              {/* Right: price info + dark button */}
              <div className="bottom-bar-right">
                <div className="bar-price-block">
                  <div className="bar-price-main">{formatPrice(total)}</div>
                  <div className="bar-price-sub">
                    <span className="sub-text">Tiết kiệm <span className="sub-value">0đ</span></span>
                  </div>
                </div>
                <button className="btn-place-order-sticky"
                  onClick={handlePlaceOrder}
                  disabled={isLoading || items.length === 0}>
                  {isLoading ? <Loader2 size={24} className="spinner" /> : 'Đặt hàng'}
                </button>
              </div>
            </div>
          </div>

          {/* Success Modal */}
          {isSuccessModalOpen && (
            <div className="modal-overlay">
              <div className="success-modal">
                <button className="modal-close-btn" onClick={handleBackToHome}>
                  <X size={24} />
                </button>
                <div className="success-icon-wrapper">
                  <Check size={32} className="success-icon" />
                </div>
                <h3 className="success-title">Đặt hàng thành công!</h3>
                <p className="success-desc">Mã đơn hàng: <strong>#{Math.floor(Math.random() * 1000000)}</strong></p>
                <button className="btn-continue-shopping" onClick={handleBackToHome}>
                  Tiếp tục mua sắm
                </button>
              </div>
            </div>
          )}

          <AddressBookModal
            isOpen={isAddressModalOpen}
            onClose={() => setIsAddressModalOpen(false)}
            onSelectAddress={handleAddressSelect}
          />

        </div>
      </div>
    </div>
  );
};

export default Checkout;
