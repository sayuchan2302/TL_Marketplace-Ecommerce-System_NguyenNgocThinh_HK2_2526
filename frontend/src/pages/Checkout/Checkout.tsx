import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, Check, Loader2, Trash2, X, ChevronDown, Tag, AlertCircle, MapPin } from 'lucide-react';
import './Checkout.css';
import { useCart } from '../../contexts/CartContext';
import { useToast } from '../../contexts/ToastContext';
import { formatPrice } from '../../utils/formatters';
import { CLIENT_TEXT } from '../../utils/texts';
import { couponService, type Coupon } from '../../services/couponService';
import { addressService } from '../../services/addressService';
import { productService } from '../../services/productService';
import { authService } from '../../services/authService';
import {
  clearSelectedCartIdsForCheckout,
  getSelectedCartIdsForCheckout,
  setSelectedCartIdsForCheckout,
} from '../../services/checkoutSelectionStore';
import {
  clearPendingVnpayCheckout,
  getPendingVnpayCheckout,
  setPendingVnpayCheckout,
} from '../../services/vnpayCheckoutStore';
import { orderService } from '../../services/orderService';
import { ApiError, apiRequest, hasBackendJwt } from '../../services/apiClient';
import type { ToastType } from '../../contexts/ToastContext';
import type { Address } from '../../types';
import AddressBookModal from './AddressBookModal';
import { useAddressLocation } from '../../hooks/useAddressLocation';

const t = CLIENT_TEXT.checkout;
const tCommon = CLIENT_TEXT.common;

interface BackendAddressPayload {
  id: string;
  fullName?: string;
  phone?: string;
  detail?: string;
  ward?: string;
  district?: string;
  province?: string;
  isDefault?: boolean;
}

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FREE_SHIPPING_THRESHOLD = 500000;
const DEFAULT_SHIPPING_FEE = 30000;
const PENDING_VNPAY_RECONCILE_TTL_MS = 2 * 60 * 60 * 1000;

const Checkout = () => {
  const navigate = useNavigate();
  const { items, updateQuantity, removeFromCart, clearCart, groupedByStore } = useCart();
  const { addToast: showToast } = useToast();
  const addToast = useCallback((message: string, type: ToastType) => {
    if (type === 'success' || type === 'info') {
      return;
    }
    showToast(message, type);
  }, [showToast]);
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'zalopay' | 'momo' | 'vnpay'>('cod');
  const [isLoading, setIsLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [formValues, setFormValues] = useState({
    name: '', phone: '', email: '',
    address: '', province: '', district: '', ward: '', note: ''
  });
  const [saveAddressToBook, setSaveAddressToBook] = useState(true);
  const [isAddressFromBook, setIsAddressFromBook] = useState(false);

  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);

  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isCouponLoading, setIsCouponLoading] = useState(false);
  const [isCouponsFetching, setIsCouponsFetching] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [selectedCartIds, setSelectedCartIds] = useState<string[]>(() => getSelectedCartIdsForCheckout());
  const [hasExplicitSelection] = useState<boolean>(() => getSelectedCartIdsForCheckout().length > 0);

  const addressLocation = useAddressLocation();
  const couponScrollRef = useRef<HTMLDivElement>(null);
  const hasReconciledPendingRef = useRef(false);

  useEffect(() => {
    if (!hasBackendJwt()) {
      addToast('Vui lòng đăng nhập để thanh toán đơn hàng', 'error');
      navigate('/login?redirect=/checkout');
    }
  }, [navigate, addToast]);

  useEffect(() => {
    const session = authService.getSession() || authService.getAdminSession();
    const sessionEmail = (session?.user?.email || '').trim();
    if (!sessionEmail) {
      return;
    }
    setFormValues((prev) => {
      if (prev.email.trim()) {
        return prev;
      }
      return {
        ...prev,
        email: sessionEmail,
      };
    });
  }, []);

  useEffect(() => {
    const el = couponScrollRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const checkoutItems = useMemo(() => {
    const validSelectedIds = selectedCartIds.filter((cartId) => items.some((item) => item.cartId === cartId));
    if (validSelectedIds.length === 0) {
      return hasExplicitSelection ? [] : items;
    }
    const selectedSet = new Set(validSelectedIds);
    return items.filter((item) => selectedSet.has(item.cartId));
  }, [hasExplicitSelection, items, selectedCartIds]);

  const storeGroups = useMemo(() => {
    const selectedSet = new Set(checkoutItems.map((item) => item.cartId));
    return groupedByStore()
      .map((group) => {
        const groupItems = group.items.filter((item) => selectedSet.has(item.cartId));
        if (groupItems.length === 0) return null;
        const subtotal = groupItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        return {
          ...group,
          items: groupItems,
          subtotal,
          shippingFee: subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : DEFAULT_SHIPPING_FEE,
        };
      })
      .filter((group): group is NonNullable<typeof group> => Boolean(group));
  }, [checkoutItems, groupedByStore]);

  const checkoutStoreIds = useMemo(
    () => Array.from(new Set(
      storeGroups
        .map((group) => group.storeId)
        .filter((storeId) => UUID_PATTERN.test(storeId)),
    )).sort(),
    [storeGroups],
  );
  const checkoutStoreKey = useMemo(() => checkoutStoreIds.join(','), [checkoutStoreIds]);
  const storeSubtotals = useMemo(
    () => storeGroups.reduce<Record<string, number>>((acc, group) => {
      acc[group.storeId] = group.subtotal;
      return acc;
    }, {}),
    [storeGroups],
  );

  const clearCartByMarker = useCallback((cartIds: string[]) => {
    const selected = Array.from(new Set(cartIds.map((value) => value.trim()).filter(Boolean)));
    if (selected.length === 0) {
      return;
    }
    const selectedSet = new Set(selected);
    const removable = items.filter((item) => selectedSet.has(item.cartId));
    if (removable.length === 0) {
      return;
    }

    if (removable.length === items.length) {
      clearCart();
    } else {
      removable.forEach((item) => removeFromCart(item.cartId));
    }

    setSelectedCartIds((prev) => {
      const next = prev.filter((id) => !selectedSet.has(id));
      setSelectedCartIdsForCheckout(next);
      return next;
    });
  }, [clearCart, items, removeFromCart]);

  useEffect(() => {
    if (hasReconciledPendingRef.current) {
      return;
    }
    hasReconciledPendingRef.current = true;

    let cancelled = false;
    const pending = getPendingVnpayCheckout();
    if (!pending || !hasBackendJwt()) {
      return () => {
        cancelled = true;
      };
    }
    if (!pending.orderCode || pending.cartIds.length === 0) {
      clearPendingVnpayCheckout();
      return () => {
        cancelled = true;
      };
    }
    if (Date.now() - pending.createdAt > PENDING_VNPAY_RECONCILE_TTL_MS) {
      clearPendingVnpayCheckout();
      return () => {
        cancelled = true;
      };
    }

    const reconcile = async () => {
      try {
        const order = await apiRequest<{ paymentStatus?: string }>(
          `/api/orders/code/${encodeURIComponent(pending.orderCode)}`,
          {},
          { auth: true },
        );
        if (cancelled) return;
        if ((order.paymentStatus || '').toUpperCase() === 'PAID') {
          clearCartByMarker(pending.cartIds);
          clearPendingVnpayCheckout();
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          clearPendingVnpayCheckout();
        }
      }
    };

    void reconcile();
    return () => {
      cancelled = true;
    };
  }, [clearCartByMarker]);

  useEffect(() => {
    let cancelled = false;
    setIsCouponsFetching(true);
    const storeIdsForCoupons = checkoutStoreKey
      ? checkoutStoreKey.split(',').filter(Boolean)
      : [];

    couponService.getAvailableCoupons(storeIdsForCoupons)
      .then((coupons) => {
        if (!cancelled) {
          setAvailableCoupons(coupons);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableCoupons([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCouponsFetching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [checkoutStoreKey]);

  useEffect(() => {
    if (!appliedCoupon) {
      return;
    }

    const stillAvailable = availableCoupons.some((coupon) => (
      coupon.code === appliedCoupon.code
      && (coupon.storeId || '') === (appliedCoupon.storeId || '')
    ));

    if (!stillAvailable) {
      setAppliedCoupon(null);
      setCouponError('Mã giảm giá đã không còn khả dụng cho giỏ hàng hiện tại');
    }
  }, [availableCoupons, appliedCoupon]);

  const handleQuantityChange = (cartId: string, delta: number) => {
    const item = checkoutItems.find(i => i.cartId === cartId);
    if (item) {
      const newQty = item.quantity + delta;
      if (newQty > 0) updateQuantity(cartId, newQty);
    }
  };

  const handleRemoveItem = (cartId: string) => {
    removeFromCart(cartId);
    setSelectedCartIds((prev) => {
      const next = prev.filter((id) => id !== cartId);
      setSelectedCartIdsForCheckout(next);
      return next;
    });
  };

  const applyCouponCode = async (code: string) => {
    setIsCouponLoading(true);
    setCouponError('');

    try {
      const result = await couponService.validate(code, subtotal, {
        storeIds: checkoutStoreIds,
        storeSubtotals,
        forceRefresh: true,
      });

      if (result.valid && result.coupon) {
        setAppliedCoupon(result.coupon);
        setCouponInput('');
        addToast(`Áp dụng mã ${result.coupon.code} thành công!`, 'success');
        return;
      }

      setCouponError(result.error || 'Mã giảm giá không hợp lệ');
    } catch {
      setCouponError('Không tải được voucher, vui lòng thử lại');
    } finally {
      setIsCouponLoading(false);
    }
  };

  const handleApplyCoupon = async () => {
    if (!couponInput.trim()) {
      setCouponError('Vui lòng nhập mã giảm giá');
      return;
    }
    await applyCouponCode(couponInput);
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponError('');
    addToast('Đã xóa mã giảm giá', 'info');
  };

  const handleSelectCoupon = async (coupon: Coupon) => {
    if (appliedCoupon?.code === coupon.code) {
      setAppliedCoupon(null);
      addToast('Đã bỏ chọn mã giảm giá', 'info');
    } else {
      await applyCouponCode(coupon.code);
    }
  };

  const subtotal = checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shippingFee = storeGroups.reduce((sum, group) => sum + group.shippingFee, 0);
  const appliedCouponOrderValue = appliedCoupon
    ? (appliedCoupon.storeId && Number.isFinite(storeSubtotals[appliedCoupon.storeId])
      ? storeSubtotals[appliedCoupon.storeId]
      : subtotal)
    : subtotal;
  const discount = appliedCoupon
    ? couponService.calculateDiscount(appliedCoupon, appliedCouponOrderValue)
    : 0;
  const total = subtotal + shippingFee - discount;
  const savings = discount;

  const handleAddressSelect = (addr: Address) => {
    setIsAddressFromBook(true);
    setFormValues(prev => ({
      ...prev,
      name: addr.fullName,
      phone: addr.phone,
      address: addr.detail,
      ward: addr.ward,
      district: addr.district,
      province: addr.province,
    }));
    void addressLocation.setLocationByNames(addr.province, addr.district, addr.ward);
    setFormErrors({});
  };

  const validate = (): FormErrors => {
    const errors: FormErrors = {};
    if (!formValues.name.trim()) errors.name = t.validation.requiredName;
    if (!formValues.phone.trim()) errors.phone = t.validation.requiredPhone;
    else if (!/^(0[3|5|7|8|9])+([0-9]{8})$/.test(formValues.phone.trim())) errors.phone = t.validation.invalidPhone;
    if (!formValues.address.trim()) errors.address = t.validation.requiredAddress;
    if (!formValues.province) errors.city = t.validation.requiredCity;
    if (!formValues.district) errors.district = t.validation.requiredDistrict;
    if (!formValues.ward) errors.ward = t.validation.requiredWard;
    return errors;
  };

  const handleFieldChange = (field: keyof FormErrors | 'email' | 'note', value: string) => {
    if (field !== 'email' && field !== 'note' && isAddressFromBook) {
      setIsAddressFromBook(false);
    }
    setFormValues(prev => ({ ...prev, [field]: value }));
    if (formErrors[field as keyof FormErrors]) {
      setFormErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const findOrCreateBackendAddress = async () => {
    const addresses = await apiRequest<BackendAddressPayload[]>('/api/addresses', {}, { auth: true });
    const matching = addresses.find((address) =>
      (address.fullName || '').trim() === formValues.name.trim() &&
      (address.phone || '').trim() === formValues.phone.trim() &&
      (address.detail || '').trim() === formValues.address.trim() &&
      (address.ward || '').trim() === formValues.ward.trim() &&
      (address.district || '').trim() === formValues.district.trim() &&
      (address.province || '').trim() === formValues.province.trim()
    );

    if (matching) {
      return matching;
    }

    return apiRequest<BackendAddressPayload>('/api/addresses', {
      method: 'POST',
      body: JSON.stringify({
        fullName: formValues.name.trim(),
        phone: formValues.phone.trim(),
        detail: formValues.address.trim(),
        ward: formValues.ward.trim(),
        district: formValues.district.trim(),
        province: formValues.province.trim(),
        isDefault: false,
      }),
    }, { auth: true });
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsLoading(true);

    try {
      if (!hasBackendJwt()) {
        throw new Error('Vui lòng đăng nhập để thanh toán.');
      }

      const orderItems = await Promise.all(
        checkoutItems.map(async (item) => {
          const backendProductId = (item.backendProductId || '').trim();
          const backendVariantId = (item.backendVariantId || '').trim();
          const primaryIdentifier = String(item.id || '').trim();
          const candidateIdentifiers = Array.from(
            new Set([primaryIdentifier, backendProductId].filter(Boolean)),
          );

          let resolvedProductId: string | undefined = (
            backendProductId && UUID_PATTERN.test(backendProductId)
          )
            ? backendProductId
            : undefined;
          let resolvedVariantId: string | undefined = (
            backendVariantId && UUID_PATTERN.test(backendVariantId)
          )
            ? backendVariantId
            : undefined;
          let activeVariantCount = 0;

          if (!resolvedVariantId) {
            for (const identifier of candidateIdentifiers) {
              const resolved = await productService.resolvePurchaseReference(
                identifier,
                item.color || undefined,
                item.size || undefined,
                { forceRefresh: true, strictPublic: true },
              );
              if (resolved.backendProductId && UUID_PATTERN.test(resolved.backendProductId)) {
                resolvedProductId = resolved.backendProductId;
                resolvedVariantId = resolved.backendVariantId;
                activeVariantCount = resolved.activeVariantCount || 0;
                break;
              }
            }
          }

          if (!resolvedProductId) {
            throw new Error(`Sản phẩm "${item.name}" chưa đồng bộ backend. Vui lòng xoá và thêm lại sản phẩm này.`);
          }

          if (!resolvedVariantId && activeVariantCount > 1) {
            throw new Error(`Sản phẩm "${item.name}" chưa chọn đúng màu/size. Vui lòng quay lại giỏ hàng và chọn lại biến thể.`);
          }

          return {
            productId: resolvedProductId,
            variantId: resolvedVariantId,
            quantity: item.quantity,
          };
        }),
      );

      const backendAddress = await findOrCreateBackendAddress();
      const backendOrder = await orderService.createBackendOrder({
        addressId: backendAddress.id,
        paymentMethod: paymentMethod.toUpperCase(),
        couponCode: appliedCoupon?.code,
        note: formValues.note.trim() || undefined,
        items: orderItems,
      });

      if (saveAddressToBook && formValues.name && formValues.phone && formValues.address) {
        addressService.add({
          fullName: formValues.name,
          phone: formValues.phone,
          detail: formValues.address,
          ward: formValues.ward,
          district: formValues.district,
          province: formValues.province,
          isDefault: false,
        });
      }

      if (appliedCoupon?.code) {
        couponService.recordUsage(appliedCoupon.code);
      }

      if (paymentMethod === 'vnpay') {
        const orderCode = String(backendOrder.code || '').trim();
        if (!orderCode) {
          throw new Error('Khong tao duoc ma don hang de thanh toan VNPAY');
        }
        const payPayload = await orderService.createVnpayPayUrl(orderCode);
        if (!payPayload.paymentUrl) {
          throw new Error('Khong tao duoc URL thanh toan VNPAY');
        }

        setPendingVnpayCheckout({
          orderCode: payPayload.orderCode || orderCode,
          cartIds: checkoutItems.map((item) => item.cartId),
          createdAt: Date.now(),
        });
        window.location.href = payPayload.paymentUrl;
        return;
      }

      if (paymentMethod === 'momo') {
        const orderCode = String(backendOrder.code || '').trim();
        if (!orderCode) {
          throw new Error('Khong tao duoc ma don hang de thanh toan MOMO');
        }
        const payPayload = await orderService.createMomoPayUrl(orderCode);
        if (!payPayload.paymentUrl) {
          throw new Error('Khong tao duoc URL thanh toan MOMO');
        }

        setPendingVnpayCheckout({
          orderCode: payPayload.orderCode || orderCode,
          cartIds: checkoutItems.map((item) => item.cartId),
          createdAt: Date.now(),
        });
        window.location.href = payPayload.paymentUrl;
        return;
      }

      if (checkoutItems.length === items.length) {
        clearCart();
      } else {
        checkoutItems.forEach((item) => removeFromCart(item.cartId));
      }
      clearPendingVnpayCheckout();
      clearSelectedCartIdsForCheckout();
      navigate(`/order-success?id=${backendOrder.code || backendOrder.id}`);
    } catch (error) {
      const message = (error instanceof ApiError && error.status === 404)
        ? 'Một hoặc nhiều sản phẩm không còn khả dụng. Vui lòng xóa và thêm lại từ trang sản phẩm.'
        : (error instanceof Error ? error.message : 'Đặt hàng thất bại. Vui lòng thử lại.');
      addToast(message, 'error');
    } finally {
      setIsLoading(false);
    }
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
            <Link to="/cart" className="breadcrumb-link">{t.breadcrumb.cart}</Link>
            <ChevronRight size={14} />
            <span className="breadcrumb-active">{t.breadcrumb.shippingInfo}</span>
            <ChevronRight size={14} />
            <span className="breadcrumb-inactive">{t.breadcrumb.paymentStep}</span>
          </div>

          <div className="checkout-layout">
            {/* ========== LEFT COLUMN ========== */}
            <div className="checkout-left-col">

              {/* Shipping Info */}
              <section className="checkout-section">
                <div className="section-header-flex">
                  <h2 className="checkout-section-title">{t.title}</h2>
                  <button className="address-book-toggle-btn" onClick={() => setIsAddressModalOpen(true)} aria-label={t.addressBook.title}>
                    {t.addressBook.title} <ChevronRight size={16} />
                  </button>
                </div>

                <div className="form-grid">
                  <div className="form-group col-span-2">
                    <label className="input-label">{t.form.name}</label>
                    <div className="input-with-prefix">
                      <select className="prefix-select" name="salutation" autoComplete="honorific-prefix">
                        <option value="anh">{t.form.salutation.male}</option>
                        <option value="chi">{t.form.salutation.female}</option>
                      </select>
                      <input
                        type="text"
                        className={`checkout-input ${formErrors.name ? 'input-error' : ''}`}
                        placeholder={t.form.namePlaceholder}
                        value={formValues.name}
                        onChange={e => handleFieldChange('name', e.target.value)}
                        name="fullName"
                        autoComplete="name"
                      />
                    </div>
                    {formErrors.name && <span className="field-error">{formErrors.name}</span>}
                  </div>

                  <div className="form-group col-span-1">
                    <label className="input-label">{t.form.phone}</label>
                    <input
                      type="tel"
                      className={`checkout-input ${formErrors.phone ? 'input-error' : ''}`}
                      placeholder={t.form.phonePlaceholder}
                      value={formValues.phone}
                      onChange={e => handleFieldChange('phone', e.target.value)}
                      name="phone"
                      autoComplete="tel"
                      inputMode="tel"
                    />
                    {formErrors.phone && <span className="field-error">{formErrors.phone}</span>}
                  </div>

                  <div className="form-group col-span-1">
                    <label className="input-label">{t.form.email}</label>
                    <input
                      type="email"
                      className="checkout-input"
                      placeholder={t.form.emailPlaceholder}
                      value={formValues.email}
                      onChange={e => handleFieldChange('email', e.target.value)}
                      name="email"
                      autoComplete="email"
                      spellCheck={false}
                    />
                  </div>

                  <div className="form-group col-span-2">
                    <label className="input-label">{t.form.address}</label>
                    <input
                      type="text"
                      className={`checkout-input ${formErrors.address ? 'input-error' : ''}`}
                      value={formValues.address}
                      onChange={e => handleFieldChange('address', e.target.value)}
                      name="streetAddress"
                      autoComplete="street-address"
                    />
                    {formErrors.address && <span className="field-error">{formErrors.address}</span>}
                  </div>

                  <div className="form-group col-span-1">
                    <div className="select-wrapper">
                      <select
                        className={`checkout-input checkout-select ${formErrors.city ? 'input-error' : ''}`}
                        value={addressLocation.selectedProvinceCode}
                        name="province"
                        autoComplete="address-level1"
                        onChange={e => {
                          addressLocation.setSelectedProvinceCode(e.target.value);
                          setFormValues((prev) => ({
                            ...prev,
                            province: addressLocation.getProvinceName(e.target.value),
                            district: '',
                            ward: '',
                          }));
                          setFormErrors((prev) => ({
                            ...prev,
                            city: undefined,
                            district: undefined,
                            ward: undefined,
                          }));
                        }}
                      >
                        <option value="">{addressLocation.loadingProvinces ? t.form.loading : t.form.province}</option>
                        {addressLocation.provinces.map(p => (
                          <option key={p.code} value={p.code}>{p.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-arrow" />
                    </div>
                    {formErrors.city && <span className="field-error">{formErrors.city}</span>}
                  </div>

                  <div className="form-group col-span-1">
                    <div className="select-wrapper">
                      <select
                        className={`checkout-input checkout-select ${formErrors.district ? 'input-error' : ''}`}
                        value={addressLocation.selectedDistrictCode}
                        disabled={!addressLocation.selectedProvinceCode}
                        name="district"
                        autoComplete="address-level2"
                        onChange={e => {
                          addressLocation.setSelectedDistrictCode(e.target.value);
                          handleFieldChange('district', addressLocation.getDistrictName(e.target.value));
                          handleFieldChange('ward', '');
                        }}
                      >
                        <option value="">{addressLocation.loadingDistricts ? t.form.loading : t.form.district}</option>
                        {addressLocation.districts.map(d => (
                          <option key={d.code} value={d.code}>{d.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-arrow" />
                    </div>
                    {formErrors.district && <span className="field-error">{formErrors.district}</span>}
                  </div>

                  <div className="form-group col-span-1">
                    <div className="select-wrapper">
                      <select
                        className={`checkout-input checkout-select ${formErrors.ward ? 'input-error' : ''}`}
                        value={addressLocation.selectedWardCode}
                        disabled={!addressLocation.selectedDistrictCode}
                        name="ward"
                        autoComplete="address-level3"
                        onChange={e => {
                          addressLocation.setSelectedWardCode(e.target.value);
                          handleFieldChange('ward', addressLocation.getWardName(e.target.value));
                        }}
                      >
                        <option value="">{addressLocation.loadingWards ? t.form.loading : t.form.ward}</option>
                        {addressLocation.wards.map(w => (
                          <option key={w.code} value={w.code}>{w.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="select-arrow" />
                    </div>
                    {formErrors.ward && <span className="field-error">{formErrors.ward}</span>}
                  </div>

                  <div className="form-group col-span-2">
                    <label className="input-label">Ghi chú</label>
                    <input type="text" className="checkout-input" placeholder="Nhập ghi chú"
                      value={formValues.note} onChange={e => handleFieldChange('note', e.target.value)}
                      name="note"
                      autoComplete="off" />
                  </div>
                </div>

                {!isAddressFromBook && (
                  <label className="save-address-checkbox">
                    <input
                      type="checkbox"
                      checked={saveAddressToBook}
                      onChange={(e) => setSaveAddressToBook(e.target.checked)}
                    />
                    <MapPin size={16} />
                    <span>Lưu vào sổ địa chỉ</span>
                  </label>
                )}

              </section>

              {/* Payment Methods */}
              <section className="checkout-section">
                <h2 className="checkout-section-title">{t.payment}</h2>
                <div className="payment-options-list">

                  <label className={`payment-card ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                    <span className="radio-circle"></span>
                    <div className="payment-info payment-col">
                      <div className="payment-row">
                        <img
                          src="https://mcdn.coolmate.me/image/October2024/mceclip2_42.png"
                          alt="COD"
                          className="payment-icon"
                          width={50}
                          height={50}
                          loading="lazy"
                        />
                        <div>
                          <span className="payment-name-text">{t.paymentMethods.cod}</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className={`payment-card ${paymentMethod === 'zalopay' ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value="zalopay" checked={paymentMethod === 'zalopay'} onChange={() => setPaymentMethod('zalopay')} />
                    <span className="radio-circle"></span>
                    <div className="payment-info payment-col">
                      <div className="payment-row">
                        <img
                          src="https://mcdn.coolmate.me/image/October2024/mceclip3_6.png"
                          alt="ZaloPay"
                          className="payment-icon"
                          width={50}
                          height={50}
                          loading="lazy"
                        />
                        <div>
                          <span className="payment-name-text">{t.paymentMethods.zalopay}</span>
                          <span className="payment-sub-text">{t.paymentMethods.zalopayDesc}</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className={`payment-card ${paymentMethod === 'momo' ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value="momo" checked={paymentMethod === 'momo'} onChange={() => setPaymentMethod('momo')} />
                    <span className="radio-circle"></span>
                    <div className="payment-info payment-col">
                      <div className="payment-row">
                        <img
                          src="https://mcdn.coolmate.me/image/October2024/mceclip1_171.png"
                          alt="MoMo"
                          className="payment-icon"
                          width={50}
                          height={50}
                          loading="lazy"
                        />
                        <div>
                          <span className="payment-name-text">{t.paymentMethods.momo}</span>
                        </div>
                      </div>
                    </div>
                  </label>

                  <label className={`payment-card ${paymentMethod === 'vnpay' ? 'selected' : ''}`}>
                    <input type="radio" name="payment" value="vnpay" checked={paymentMethod === 'vnpay'} onChange={() => setPaymentMethod('vnpay')} />
                    <span className="radio-circle"></span>
                    <div className="payment-info payment-col">
                      <div className="payment-row">
                        <img
                          src="https://mcdn.coolmate.me/image/October2024/mceclip0_81.png"
                          alt="VNPay"
                          className="payment-icon"
                          width={50}
                          height={50}
                          loading="lazy"
                        />
                        <div>
                          <span className="payment-name-text">{t.paymentMethods.vnpay}</span>
                          <span className="vnpay-promo-badge">{t.paymentMethods.vnpayPromo}</span>
                        </div>
                      </div>
                    </div>
                  </label>

                </div>
                <div className="payment-return-policy">
                  {t.returnPolicy} <Link to="#">{tCommon.actions.viewDetails}</Link>.
                </div>
              </section>
            </div>

            {/* ========== RIGHT COLUMN ========== */}
            <div className="checkout-right-col">
              <div className="checkout-summary-wrapper">

                {/* Freeship Alert */}
                <div className="freeship-alert">
                  <Check size={18} /> {t.freeshipAlert}
                </div>

                {/* Cart Header */}
                <div className="cart-header-actions">
                  <span className="cart-item-count">{t.cartItemCount.replace('{count}', String(checkoutItems.length))}</span>
                </div>

                {/* Cart Items */}
                <div className="unified-cart-list">
                  {checkoutItems.length === 0 ? (
                    <div className="empty-cart-msg">{t.emptyCart}</div>
                  ) : (
                    checkoutItems.map(item => (
                      <div className="unified-cart-item" key={item.cartId}>
                        <img src={item.image}
                          alt={item.name} className="unified-item-img" />

                        <div className="unified-item-info">
                          <Link to={`/product/${item.id}`} className="unified-item-name">{item.name}</Link>
                          <div className="variant-selectors">
                            <div className="fake-select">{item.color} <ChevronRight size={14} /></div>
                            <div className="fake-select">{item.size} <ChevronRight size={14} /></div>
                          </div>
                          <button className="unified-item-remove" onClick={() => handleRemoveItem(item.cartId)} aria-label={t.remove}>
                            <Trash2 size={14} aria-hidden="true" /> {t.remove}
                          </button>
                        </div>

                        <div className="unified-qty-price">
                          <div className="unified-qty-control">
                            <button onClick={() => handleQuantityChange(item.cartId, -1)} disabled={item.quantity <= 1} aria-label="Giảm số lượng">-</button>
                            <span>{item.quantity}</span>
                            <button onClick={() => handleQuantityChange(item.cartId, 1)} aria-label="Tăng số lượng">+</button>
                          </div>
                          <div className="unified-item-price">{formatPrice(item.price)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Coupon Tickets */}
                <div className="coupon-ticket-title">Kho mã giảm giá</div>
                <div className="coupon-ticket-scroll" ref={couponScrollRef}>
                  {isCouponsFetching && (
                    <div className="coupon-ticket">
                      <div className="ticket-info">Đang tải voucher khả dụng...</div>
                    </div>
                  )}
                  {!isCouponsFetching && availableCoupons.length === 0 && (
                    <div className="coupon-ticket">
                      <div className="ticket-info">Hiện chưa có voucher phù hợp cho giỏ hàng này.</div>
                    </div>
                  )}
                  {!isCouponsFetching && availableCoupons.map((coupon) => (
                    <div
                      key={coupon.code}
                      className={`coupon-ticket ${appliedCoupon?.code === coupon.code ? 'coupon-selected' : ''}`}
                      onClick={() => handleSelectCoupon(coupon)}
                    >
                      <div className="ticket-info">
                        <strong>{coupon.code}</strong> ({t.ticketRemaining.replace('{count}', String(coupon.remaining))})<br />
                        <span className="ticket-desc">{coupon.description}</span>
                        <div className="ticket-expiry">{t.ticketExpiry.replace('{date}', new Date(coupon.expiresAt).toLocaleDateString('vi-VN'))}</div>
                      </div>
                      <div className="ticket-action">
                        <div className={`ticket-radio ${appliedCoupon?.code === coupon.code ? 'checked' : ''}`}>
                          {appliedCoupon?.code === coupon.code && <Check size={12} />}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Voucher Input */}
                <div className="checkout-coupon-box">
                  <div className="input-group-row">
                    <input
                      type="text"
                      placeholder={t.enterCouponCode}
                      className={`checkout-input coupon-input ${couponError ? 'input-error' : ''}`}
                      value={couponInput}
                      onChange={(e) => {
                        setCouponInput(e.target.value.toUpperCase());
                        setCouponError('');
                      }}
                      disabled={!!appliedCoupon}
                    />
                    {appliedCoupon ? (
                      <button className="btn-remove-coupon" onClick={handleRemoveCoupon} aria-label="Xóa mã giảm giá">
                        <X size={16} aria-hidden="true" />
                      </button>
                    ) : (
                      <button
                        className="btn-dark-apply"
                        onClick={handleApplyCoupon}
                        disabled={isCouponLoading}
                        aria-label="Áp dụng mã giảm giá"
                      >
                        {isCouponLoading ? <Loader2 size={16} className="spinner" /> : t.apply}
                      </button>
                    )}
                  </div>
                  {couponError && (
                    <div className="coupon-error">
                      <AlertCircle size={14} /> {couponError}
                    </div>
                  )}
                  {appliedCoupon && (
                    <div className="coupon-success">
                      <Tag size={14} />
                      <span>{t.couponApplied.replace('{code}', appliedCoupon.code).replace('{description}', appliedCoupon.description)}</span>
                    </div>
                  )}
                </div>

                {/* Order Calculations */}
                <div className="checkout-calculations">
                  <h3 className="calc-title">Chi tiết thanh toán</h3>

                  <div className="calc-row">
                    <span className="calc-label">{t.productValue}</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>

                  <div className="calc-row">
                    <span className="calc-label">{t.shippingCost}</span>
                    <span>{shippingFee === 0 ? t.free : formatPrice(shippingFee)}</span>
                  </div>

                  {appliedCoupon && discount > 0 && (
                    <div className="calc-row calc-discount">
                      <span className="calc-label">{t.discount.replace('{code}', appliedCoupon.code)}</span>
                      <span className="discount-value">-{formatPrice(discount)}</span>
                    </div>
                  )}

                  <div className="calc-row calc-total">
                    <strong>{t.total}</strong>
                    <div className="total-value-block">
                      <strong className="total-price-big">{formatPrice(total)}</strong>
                      {savings > 0 && (
                        <div className="savings-note">Tiết kiệm {formatPrice(savings)}</div>
                      )}
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
                    {appliedCoupon ? (
                      <>
                        <img src="https://n7media.coolmate.me/uploads/March2024/voucher-logo-mb.png?aio=w-300" alt="Voucher" className="voucher-icon-img" />
                        <span className="voucher-code-text">{appliedCoupon.code}</span>
                      </>
                    ) : (
                      <>
                        <img src="https://n7media.coolmate.me/uploads/March2024/voucher-logo-mb.png?aio=w-300" alt="Voucher" className="voucher-icon-img" />
                        <span>Voucher</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: price info + dark button */}
              <div className="bottom-bar-right">
                <div className="bar-price-block">
                  <div className="bar-price-main">{formatPrice(total)}</div>
                  <div className="bar-price-points">
                    <span>Điểm tích lũy: <span className="points-value">+{Math.floor(total / 1000).toLocaleString('vi-VN')}</span></span>
                    {savings > 0 && (
                      <span className="savings-text"> | Tiết kiệm: <span className="sub-value">{formatPrice(savings)}</span></span>
                    )}
                  </div>
                </div>
                <button className="btn-place-order-sticky"
                  onClick={handlePlaceOrder}
                  disabled={isLoading || checkoutItems.length === 0}>
                  {isLoading ? <Loader2 size={24} className="spinner" /> : t.orderPlaced}
                </button>
              </div>
            </div>
          </div>

          {/* Success Modal */}
          {isSuccessModalOpen && (
            <div className="modal-overlay">
              <div className="success-modal">
                <button className="modal-close-btn" onClick={handleBackToHome} aria-label="Đóng">
                  <X size={24} aria-hidden="true" />
                </button>
                <div className="success-icon-wrapper">
                  <Check size={32} className="success-icon" />
                </div>
                <h3 className="success-title">Đặt hàng thành công!</h3>
                <p className="success-desc">Mã đơn hàng: <strong>#{Math.floor(Math.random() * 1000000)}</strong></p>
                <button className="btn-continue-shopping" onClick={handleBackToHome} aria-label="Tiếp tục mua sắm">
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


