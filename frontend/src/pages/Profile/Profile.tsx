import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  User,
  ShoppingBag,
  Ticket,
  MapPin,
  MessageSquare,
  ChevronRight,
  LogOut,
  X,
  Lock,
  Eye,
  EyeOff,
  Trash2,
  Bell,
  Package,
  Tag,
  Star,
  Info,
  Trash,
  Pencil
} from 'lucide-react';
import AddressModal from './AddressModal';
import EmptyState from '../../components/EmptyState/EmptyState';
import ReviewModal from '../../components/ReviewModal/ReviewModal';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import Skeleton from '../../components/Skeleton/Skeleton';
import { CLIENT_TEXT } from '../../utils/texts';
import { CLIENT_TOAST_MESSAGES } from '../../utils/clientMessages';
import { notificationService } from '../../services/notificationService';
import { addressService } from '../../services/addressService';
import { orderService } from '../../services/orderService';
import { reviewService, type EligibleReviewItem, type Review as CustomerReview } from '../../services/reviewService';
import { couponService, type Coupon } from '../../services/couponService';
import { profileService, type UserProfileRecord } from '../../services/profileService';
import { authService } from '../../services/authService';
import { calculateTier, TIER_CONFIG, getProgressToNextTier, getSpendRequiredForNextTier, getNextTier } from '../../utils/tierUtils';
import { formatPrice } from '../../utils/formatters';
import { resolveDetailRouteKey } from '../../utils/displayCode';
import type { Address } from '../../types';
import type { Order } from '../../types';
import './Profile.css';

const t = CLIENT_TEXT.profile;
const tCommon = CLIENT_TEXT.common;

type TabId = 'account' | 'orders' | 'vouchers' | 'addresses' | 'reviews' | 'notifications';
const VALID_PROFILE_TABS: TabId[] = ['account', 'orders', 'vouchers', 'addresses', 'reviews', 'notifications'];

interface PendingProduct {
  productId: string;
  productName: string;
  productImage: string;
  orderId: string;
  orderCode?: string;
  variant: string;
}

const mapEligibleReview = (item: EligibleReviewItem): PendingProduct => {
  const details = [
    item.variantName?.trim() || null,
    item.quantity > 0 ? `Số lượng: ${item.quantity}` : null,
  ].filter(Boolean).join(' | ');

  return {
    productId: item.productId,
    productName: item.productName,
    productImage: item.productImage || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=80&h=80&fit=crop',
    orderId: item.orderId,
    orderCode: item.orderCode,
    variant: details || 'Đơn hàng đã giao',
  };
};

const GENDER_LABEL: Record<'MALE' | 'FEMALE' | 'OTHER', string> = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
  OTHER: 'Khác',
};

const Profile = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { logout, user: authUser } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfileRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressesError, setAddressesError] = useState<string | null>(null);
  const activeTab = useMemo(() => {
    const tabParam = searchParams.get('tab');
    return VALID_PROFILE_TABS.includes(tabParam as TabId) ? (tabParam as TabId) : 'account';
  }, [searchParams]);

  const handleTabChange = (tab: TabId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (tab === 'account') {
      nextParams.delete('tab');
    } else {
      nextParams.set('tab', tab);
    }
    nextParams.delete('orderId');
    setSearchParams(nextParams);
  };

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [height, setHeight] = useState('163');
  const [weight, setWeight] = useState('57');
  const [accountName, setAccountName] = useState('');
  const [accountPhone, setAccountPhone] = useState('');
  const [accountGender, setAccountGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('OTHER');
  const [accountDateOfBirth, setAccountDateOfBirth] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [voucherWallet, setVoucherWallet] = useState<Coupon[]>([]);

  const handleEditAddress = (address: Address) => {
    setEditingAddress(address);
    setIsAddressModalOpen(true);
  };

  const handleAddAddress = () => {
    setEditingAddress(null);
    setIsAddressModalOpen(true);
  };

  const handleCloseAddressModal = () => {
    setIsAddressModalOpen(false);
    setEditingAddress(null);
  };

  const orders = activeTab === 'orders' ? allOrders : [];
  const vouchers = activeTab === 'vouchers' ? voucherWallet : [];
  const orderCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    allOrders.forEach((order) => {
      if (order.id && order.code) {
        map.set(order.id, order.code);
      }
    });
    return map;
  }, [allOrders]);
  const getOrderDisplayCode = useCallback(
    (orderId: string, orderCode?: string) => {
      const code = (orderCode || orderCodeMap.get(orderId) || '').trim();
      return code || 'Đang cập nhật mã đơn';
    },
    [orderCodeMap],
  );
  const [orderFilter, setOrderFilter] = useState('Tất cả');

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<PendingProduct | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'completed'>('pending');
  const [pendingReviews, setPendingReviews] = useState<PendingProduct[]>([]);
  const [completedReviews, setCompletedReviews] = useState<CustomerReview[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);

  const handleOpenReviewModal = (product: PendingProduct) => {
    setReviewProduct(product);
    setIsReviewModalOpen(true);
  };

  const handleCloseReviewModal = () => {
    setIsReviewModalOpen(false);
    setReviewProduct(null);
    if (activeTab === 'reviews') {
      void loadReviews();
    }
  };

  const loadReviews = useCallback(async () => {
    try {
      setReviewsLoading(true);
      setReviewsError(null);
      const [eligible, mine] = await Promise.all([
        reviewService.getEligibleReviews(),
        reviewService.getReviews(),
      ]);
      setPendingReviews(eligible.map(mapEligibleReview));
      setCompletedReviews(mine);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách đánh giá.';
      setReviewsError(message);
      setPendingReviews([]);
      setCompletedReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  }, []);

  const openOrderDetail = (order: Order) => {
    const routeKey = resolveDetailRouteKey(order.code, order.id);
    if (!routeKey) return;
    navigate(`/profile/orders/${encodeURIComponent(routeKey)}`);
  };

  const loadOrders = useCallback(async () => {
    try {
      setOrdersLoading(true);
      setOrdersError(null);
      const rows = await orderService.listFromBackend();
      setAllOrders(rows);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể tải đơn hàng.';
      setOrdersError(message);
      setAllOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const syncAuthSession = useCallback((nextProfile: UserProfileRecord) => {
    const existingSession = authService.getSession() || authService.getAdminSession();
    if (!existingSession) return;

    const mergedUser = {
      ...existingSession.user,
      name: nextProfile.name || existingSession.user.name,
      email: nextProfile.email || existingSession.user.email,
      phone: nextProfile.phone || undefined,
      avatar: nextProfile.avatar || existingSession.user.avatar,
      role: nextProfile.role || existingSession.user.role,
      storeId: nextProfile.storeId || existingSession.user.storeId,
    };

    authService.updateSession(mergedUser);
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      setProfileLoading(true);
      setProfileError(null);
      const nextProfile = await profileService.getMyProfile();
      setProfile(nextProfile);
      syncAuthSession(nextProfile);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể tải hồ sơ tài khoản.';
      setProfileError(message);
    } finally {
      setProfileLoading(false);
    }
  }, [syncAuthSession]);

  const loadAddresses = useCallback(async () => {
    try {
      setAddressesLoading(true);
      setAddressesError(null);
      const rows = await addressService.listFromBackend();
      setSavedAddresses(rows);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể tải danh sách địa chỉ.';
      setAddressesError(message);
      setSavedAddresses([]);
    } finally {
      setAddressesLoading(false);
    }
  }, []);

  const totalSpent = useMemo(
    () => allOrders
      .filter((order) => order.status === 'delivered')
      .reduce((sum, order) => sum + order.total, 0),
    [allOrders],
  );
  const pointsFromOrders = Math.round(totalSpent / 1000);

  const user = useMemo(() => {
    const name = profile?.name || authUser?.name || 'Khách hàng';
    const email = profile?.email || authUser?.email || '';
    const phone = profile?.phone || authUser?.phone || '';
    const avatar = profile?.avatar || authUser?.avatar || name.charAt(0).toUpperCase();
    const dateOfBirthLabel = profile?.dateOfBirth
      ? new Date(`${profile.dateOfBirth}T00:00:00`).toLocaleDateString('vi-VN')
      : 'Chưa cập nhật';
    const loyaltyPoints = (profile?.loyaltyPoints ?? 0) > 0 ? (profile?.loyaltyPoints ?? 0) : pointsFromOrders;

    return {
      name,
      phone: phone || 'Chưa cập nhật',
      gender: GENDER_LABEL[profile?.gender || 'OTHER'],
      dob: dateOfBirthLabel,
      height: profile?.height ? `${profile.height} cm` : 'Chưa cập nhật',
      weight: profile?.weight ? `${profile.weight} kg` : 'Chưa cập nhật',
      email: email || 'Chưa cập nhật',
      avatar,
      totalSpent,
      points: loyaltyPoints,
    };
  }, [authUser, pointsFromOrders, profile, totalSpent]);

  const currentTier = calculateTier(user.totalSpent);
  const nextTier = getNextTier(currentTier);
  const progress = getProgressToNextTier(user.totalSpent, currentTier);
  const requiredForNext = getSpendRequiredForNextTier(currentTier, user.totalSpent);
  const tierConfig = TIER_CONFIG[currentTier];

  const tabs = [
    { id: 'account', label: t.tabs.account, icon: User },
    { id: 'orders', label: t.tabs.orders, icon: ShoppingBag },
    { id: 'vouchers', label: t.tabs.vouchers, icon: Ticket },
    { id: 'addresses', label: t.tabs.addresses, icon: MapPin },
    { id: 'reviews', label: t.tabs.reviews, icon: MessageSquare },
    { id: 'notifications', label: 'Thông báo', icon: Bell, badge: unreadCount > 0 ? unreadCount : undefined },
  ];

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    void loadProfile();
    void loadOrders();
  }, [loadOrders, loadProfile]);

  useEffect(() => {
    if (activeTab !== 'orders') {
      return;
    }
    void loadOrders();
  }, [activeTab, loadOrders]);

  useEffect(() => {
    if (activeTab !== 'addresses') {
      return;
    }
    void loadAddresses();
  }, [activeTab, loadAddresses]);

  useEffect(() => {
    if (activeTab !== 'vouchers') {
      return;
    }

    let cancelled = false;
    couponService.getAvailableCoupons()
      .then((coupons) => {
        if (!cancelled) {
          setVoucherWallet(coupons);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVoucherWallet([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'reviews') {
      return;
    }
    void loadReviews();
  }, [activeTab, loadReviews]);

  useEffect(() => {
    if (!isAccountModalOpen) {
      return;
    }
    setAccountName(profile?.name || authUser?.name || '');
    setAccountPhone(profile?.phone || authUser?.phone || '');
    setAccountGender(profile?.gender || 'OTHER');
    setAccountDateOfBirth(profile?.dateOfBirth || '');
    setHeight(String(profile?.height ?? 163));
    setWeight(String(profile?.weight ?? 57));
  }, [authUser, isAccountModalOpen, profile]);

  useEffect(() => {
    const anyModalOpen = isAccountModalOpen || isPasswordModalOpen || isAddressModalOpen || isReviewModalOpen;
    if (anyModalOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => document.body.classList.remove('modal-open');
  }, [isAccountModalOpen, isPasswordModalOpen, isAddressModalOpen, isReviewModalOpen]);

  const handleLogout = () => {
    logout();
    addToast(CLIENT_TOAST_MESSAGES.auth.logoutSuccess, "info");
    navigate('/');
  };

  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowOldPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const handleAccountSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSavingProfile) return;

    try {
      setIsSavingProfile(true);
      const parsedHeight = Number(height);
      const parsedWeight = Number(weight);
      const nextProfile = await profileService.updateMyProfile({
        name: accountName,
        phone: accountPhone,
        gender: accountGender,
        dateOfBirth: accountDateOfBirth || null,
        height: Number.isFinite(parsedHeight) ? parsedHeight : null,
        weight: Number.isFinite(parsedWeight) ? parsedWeight : null,
      });
      setProfile(nextProfile);
      syncAuthSession(nextProfile);
      setIsAccountModalOpen(false);
      addToast('Đã cập nhật thông tin tài khoản', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật hồ sơ.';
      addToast(message, 'error');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isChangingPassword) return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      addToast('Vui lòng nhập đầy đủ thông tin mật khẩu.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      addToast('Mật khẩu mới và xác nhận mật khẩu chưa khớp.', 'error');
      return;
    }

    try {
      setIsChangingPassword(true);
      await profileService.changePassword({
        currentPassword,
        newPassword,
      });
      closePasswordModal();
      addToast('Đổi mật khẩu thành công', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể đổi mật khẩu.';
      addToast(message, 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRemoveAddress = async (addressId: string) => {
    try {
      await addressService.removeOnBackend(addressId);
      await loadAddresses();
      addToast('Đã xóa địa chỉ', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Không thể xóa địa chỉ.';
      addToast(message, 'error');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'account':
        return (
          <div className="tab-pane">
            <div className="profile-content-header mb-6">
              <h2 className="profile-content-title">Thông tin tài khoản</h2>
            </div>
            {profileLoading ? <p className="account-meta">Đang tải hồ sơ tài khoản...</p> : null}
            {profileError ? <p className="account-meta">{profileError}</p> : null}

            <div className="account-info-form">
              {/* Personal Info */}
              <div className="info-group">
                <div className="info-row">
                  <span className="info-label text-gray-500">Họ và tên</span>
                  <span className="info-value font-medium">{user.name}</span>
                </div>
                <div className="info-row">
                  <span className="info-label text-gray-500">Số điện thoại</span>
                  <span className="info-value font-medium">{user.phone}</span>
                </div>
                <div className="info-row">
                  <span className="info-label text-gray-500">Giới tính</span>
                  <span className="info-value font-medium">{user.gender}</span>
                </div>
                <div className="info-row">
                  <span className="info-label text-gray-500">Ngày sinh</span>
                  <span className="info-value font-medium">{user.dob}</span>
                </div>
                <div className="info-row">
                  <span className="info-label text-gray-500">Chiều cao</span>
                  <span className="info-value font-medium">{user.height}</span>
                </div>
                <div className="info-row">
                  <span className="info-label text-gray-500">Cân nặng</span>
                  <span className="info-value font-medium">{user.weight}</span>
                </div>

                <button 
                  className="profile-btn-outline mt-8"
                  onClick={() => setIsAccountModalOpen(true)}
                >
                  CẬP NHẬT
                </button>
              </div>

              {/* Login Info */}
              <div className="info-group mt-10">
                <div className="profile-content-header mb-6">
                  <h3 className="profile-content-title">Thông tin đăng nhập</h3>
                </div>
                <div className="info-row">
                  <span className="info-label text-gray-500">Email</span>
                  <span className="info-value font-medium">{user.email}</span>
                </div>
                <div className="info-row">
                  <span className="info-label text-gray-500">Mật khẩu</span>
                  <span className="info-value font-medium">••••••••••••••</span>
                </div>

                <button 
                  className="profile-btn-outline mt-8"
                  onClick={() => setIsPasswordModalOpen(true)}
                >
                  CẬP NHẬT
                </button>
              </div>
            </div>
          </div>
        );
      case 'orders':
        return (
          <div className="tab-pane">
            <div className="profile-content-header">
              <h2 className="profile-content-title">Lịch sử đơn hàng</h2>
            </div>

            {/* Order Status Filter Tabs */}
            <div className="order-filter-tabs">
              {['Tất cả', 'Chờ xác nhận', 'Đang giao', 'Đã giao', 'Đã hủy'].map((status) => (
                <button 
                  key={status} 
                  className={`order-filter-btn ${orderFilter === status ? 'active' : ''}`}
                  onClick={() => setOrderFilter(status)}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Order Status Filter */}
            {(() => {
              const statusMap: Record<string, string> = {
                'Tất cả': 'all',
                'Chờ xác nhận': 'pending',
                'Đang giao': 'shipping',
                'Đã giao': 'delivered',
                'Đã hủy': 'cancelled',
              };
              const filteredOrders = orderFilter === 'Tất cả' 
                ? orders 
                : orders.filter(o => o.status === statusMap[orderFilter]);
              return (
            <div className="order-list">
              {ordersLoading ? (
                <div className="account-meta">Đang tải đơn hàng...</div>
              ) : ordersError ? (
                <div className="account-meta">{ordersError}</div>
              ) : filteredOrders.length === 0 ? (
                <EmptyState 
                  icon={<Package size={80} strokeWidth={1} />}
                  title="Bạn chưa có đơn hàng nào"
                  description="Hãy trải nghiệm các sản phẩm của Coolmate để bắt đầu hành trình mua sắm của bạn!"
                  actionText="Mua sắm ngay"
                  actionLink="/"
                />
              ) : (
                filteredOrders.map((order) => (
                  <div key={order.id} className="order-card">
                    <div className="order-card-header">
                      <div className="order-card-meta">
                        <button 
                          className="order-id-link"
                          onClick={() => openOrderDetail(order)}
                        >
                          Mã đơn: #{order.code || order.id}
                        </button>
                        <span className="order-date">{new Date(order.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <span className={`order-status-badge status-${order.status}`}>
                        {tCommon.status[order.status]}
                      </span>
                    </div>
                    <div className="order-card-items">
                      {order.items.slice(0, 2).map((item, idx) => (
                        <div key={idx} className="order-item">
                          <div className="order-item-img">
                            <img src={item.image} alt={item.name} />
                          </div>
                          <div className="order-item-info">
                            <p className="order-item-name">{item.name}</p>
                            {item.color && <p className="order-item-variant">Màu: {item.color}</p>}
                            {item.size && <p className="order-item-variant">Size: {item.size}</p>}
                            <p className="order-item-qty">x{item.quantity}</p>
                          </div>
                          <span className="order-item-price">{item.price.toLocaleString('vi-VN')}đ</span>
                        </div>
                      ))}
                      {order.items.length > 2 && (
                        <p className="order-more-items">+{order.items.length - 2} sản phẩm khác</p>
                      )}
                    </div>
                    <div className="order-card-footer">
                      <div className="order-total">
                        <span>Tổng cộng:</span>
                        <span className="order-total-price">{order.total.toLocaleString('vi-VN')}đ</span>
                      </div>
                      <div className="order-actions">
                        {order.status === 'pending' && (
                          <button 
                            className="order-action-btn order-btn-danger"
                            onClick={async () => {
                              if (confirm('Bạn có chắc chắn muốn hủy đơn hàng này?')) {
                                try {
                                  await orderService.cancelOnBackend(order.id, 'Khách hàng hủy đơn');
                                  await loadOrders();
                                  addToast('Đã hủy đơn hàng thành công', 'success');
                                } catch (error: unknown) {
                                  const message = error instanceof Error ? error.message : 'Không thể hủy đơn hàng.';
                                  addToast(message, 'error');
                                }
                              }
                            }}
                          >
                            Hủy đơn hàng
                          </button>
                        )}
                        <button 
                          className="order-action-btn order-btn-outline"
                          onClick={() => openOrderDetail(order)}
                        >
                          Xem chi tiết
                        </button>
                        {order.status === 'delivered' && (
                          <button className="order-action-btn order-btn-primary">Đánh giá</button>
                        )}
                        {order.status === 'shipping' && (
                          <button className="order-action-btn order-btn-primary">Theo dõi đơn</button>
                        )}
                        {order.status === 'cancelled' && (
                          <button className="order-action-btn order-btn-outline">Mua lại</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
              );
            })()}
          </div>
        );
      case 'vouchers':
        return (
          <div className="tab-pane">
            <div className="profile-content-header">
              <h2 className="profile-content-title">Ví voucher của tôi</h2>
            </div>
            <div className="voucher-list">
              {vouchers.length === 0 ? (
                <EmptyState 
                  icon={<Ticket size={80} strokeWidth={1} />}
                  title="Ví voucher trống"
                  description="Săn ngay những mã giảm giá hấp dẫn để mua sắm tiết kiệm hơn tại Coolmate."
                  actionText="Săn Voucher"
                  actionLink="/"
                />
              ) : (
                vouchers.map((voucher) => (
                  <div key={voucher.code} className="voucher-card">
                    <div className="voucher-stripe"></div>
                    <div className="voucher-body">
                      <div className="voucher-top">
                        <span className="voucher-code">{voucher.code}</span>
                        <span className="voucher-remain">(Còn {voucher.remaining})</span>
                      </div>
                      <p className="voucher-desc">{voucher.description}</p>
                      <div className="voucher-bottom">
                        <span className="voucher-expiry">HSD: {new Date(voucher.expiresAt).toLocaleDateString('vi-VN')}</span>
                        <button className="voucher-condition-btn">Điều kiện</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'addresses':
        return (
          <div className="tab-pane">
            <div className="address-header">
              <h2 className="profile-content-title">Địa chỉ của tôi</h2>
              <button className="address-add-btn" onClick={handleAddAddress}>
                <span>+</span> THÊM ĐỊA CHỈ MỚI
              </button>
            </div>
            
            <div className="address-book-content">
              <h3 className="address-book-subtitle">Sổ địa chỉ</h3>
              {addressesLoading ? <p className="account-meta">Đang tải danh sách địa chỉ...</p> : null}
              {addressesError ? <p className="account-meta">{addressesError}</p> : null}
              
              {!addressesLoading && savedAddresses.length === 0 ? (
                <EmptyState 
                  icon={<MapPin size={80} strokeWidth={1} />}
                  title="Sổ địa chỉ trống"
                  description="Bạn chưa có địa chỉ nào được lưu. Thêm địa chỉ để quá trình đặt hàng nhanh chóng hơn."
                />
              ) : !addressesLoading ? (
                <div className="address-list">
                  {savedAddresses.map((addr) => (
                    <div key={addr.id} className="address-card">
                      <div className="address-card-info">
                        <div className="address-card-top">
                          <span className="address-card-name">{addr.fullName}</span>
                          <span className="address-card-divider">|</span>
                          <span className="address-card-phone">{addr.phone}</span>
                          {addr.isDefault && <span className="address-default-badge">Mặc định</span>}
                        </div>
                        <p className="address-card-detail">{addr.detail}</p>
                        <p className="address-card-region">{addr.ward}, {addr.district}, {addr.province}</p>
                      </div>
                      <div className="address-card-actions">
                        <button 
                          className="address-card-edit" 
                          onClick={() => handleEditAddress(addr)}
                          aria-label="Chỉnh sửa địa chỉ"
                        >
                          <Pencil size={16} />
                        </button>
                        <button 
                          className="address-card-delete" 
                          onClick={() => void handleRemoveAddress(addr.id)}
                          aria-label="Xóa địa chỉ"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        );
      case 'reviews':
        return (
          <div className="tab-pane">
            <div className="profile-content-header">
              <h2 className="profile-content-title">Đánh giá & Phản hồi</h2>
            </div>

            {/* Review Filter Tabs */}
            <div className="order-filter-tabs">
              <button 
                className={`order-filter-btn ${reviewFilter === 'pending' ? 'active' : ''}`}
                onClick={() => setReviewFilter('pending')}
              >
                Chờ đánh giá ({pendingReviews.length})
              </button>
              <button 
                className={`order-filter-btn ${reviewFilter === 'completed' ? 'active' : ''}`}
                onClick={() => setReviewFilter('completed')}
              >
                Đã đánh giá ({completedReviews.length})
              </button>
            </div>

            {reviewsLoading ? (
              <div className="review-empty">
                <p>Đang tải danh sách đánh giá...</p>
              </div>
            ) : null}

            {!reviewsLoading && reviewsError ? (
              <div className="review-empty">
                <p>{reviewsError}</p>
              </div>
            ) : null}

            {reviewFilter === 'pending' && (
              <div className="review-section">
                <h3 className="review-section-title">Sản phẩm chờ đánh giá</h3>
                {!reviewsLoading && !reviewsError && pendingReviews.length > 0 ? (
                  <div className="review-pending-list">
                    {pendingReviews.map((product) => (
                      <div key={product.productId} className="review-pending-card">
                        <div className="review-pending-product">
                          <div className="review-product-img">
                            <img src={product.productImage} alt={product.productName} />
                          </div>
                          <div className="review-product-info">
                            <p className="review-product-name">{product.productName}</p>
                            <p className="review-product-variant">{product.variant}</p>
                            <p className="review-product-order">Đơn hàng: #{getOrderDisplayCode(product.orderId, product.orderCode)}</p>
                          </div>
                        </div>
                        <button 
                          className="review-write-btn"
                          onClick={() => handleOpenReviewModal(product)}
                        >
                          Viết đánh giá
                        </button>
                      </div>
                    ))}
                  </div>
                ) : !reviewsLoading && !reviewsError ? (
                  <div className="review-empty">
                    <p>Không có sản phẩm nào chờ đánh giá</p>
                  </div>
                ) : null}
              </div>
            )}

            {reviewFilter === 'completed' && (
              <div className="review-section">
                <h3 className="review-section-title">Đánh giá của bạn</h3>
                {!reviewsLoading && !reviewsError && completedReviews.length > 0 ? (
                  <div className="review-completed-list">
                    {completedReviews.map((review) => (
                      <div key={review.id} className="review-completed-card">
                        <div className="review-completed-header">
                          <div className="review-pending-product">
                            <div className="review-product-img">
                              <img
                                src={review.productImage || 'https://images.unsplash.com/photo-1542272604-787c3835535d?w=80&h=80&fit=crop'}
                                alt={review.productName}
                              />
                            </div>
                            <div className="review-product-info">
                              <p className="review-product-name">{review.productName}</p>
                              <p className="review-product-variant">Đơn hàng: #{getOrderDisplayCode(review.orderId, review.orderCode)}</p>
                            </div>
                          </div>
                          <span className="review-date">{new Date(review.createdAt).toLocaleDateString('vi-VN')}</span>
                        </div>
                        <div className="review-stars">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i} className={`review-star ${i < review.rating ? 'filled' : ''}`}>★</span>
                          ))}
                        </div>
                        <p className="review-text">{review.content}</p>
                        {review.shopReply ? (
                          <div className="review-reply">
                            <div className="review-reply-header">
                              <span className="review-reply-badge">Phản hồi từ shop</span>
                            </div>
                            <p className="review-reply-text">{review.shopReply.content}</p>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : !reviewsLoading && !reviewsError ? (
                  <div className="review-empty">
                    <p>Bạn chưa có đánh giá nào</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        );
      case 'notifications':
        return (
          <div className="tab-pane">
            <div className="profile-content-header notify-header">
              <h2 className="profile-content-title">Thông báo</h2>
              {notifications.length > 0 && (
                <button 
                  className="mark-all-read-text-btn"
                  onClick={() => {
                    markAllAsRead();
                    addToast(CLIENT_TOAST_MESSAGES.notifications.markedAllRead, 'success');
                  }}
                  disabled={unreadCount === 0}
                >
                  Đánh dấu tất cả đã đọc
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="notifications-empty">
                <Bell size={64} strokeWidth={1} />
                <p>Không có thông báo nào</p>
              </div>
            ) : (
              <div className="notifications-list">
                {notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    className={`notification-card ${!notif.read ? 'unread' : ''}`}
                    onClick={() => {
                      if (!notif.read) {
                        markAsRead(notif.id);
                      }
                      if (notif.link) {
                        navigate(notif.link);
                      }
                    }}
                  >
                    <div className={`notification-icon notification-icon-${notif.type}`}>
                      {notif.type === 'order' && <Package size={20} />}
                      {notif.type === 'promotion' && <Tag size={20} />}
                      {notif.type === 'review' && <Star size={20} />}
                      {notif.type === 'system' && <Info size={20} />}
                    </div>
                    <div className="notification-content">
                      <p className="notification-title">
                        {notif.title}
                        <span className="notification-time">
                          {notificationService.formatTimeAgo(notif.createdAt)}
                        </span>
                      </p>
                      <p className="notification-message">{notif.message}</p>
                    </div>
                    <button 
                      className="notification-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notif.id);
                        addToast(CLIENT_TOAST_MESSAGES.notifications.deleted, 'info');
                      }}
                      aria-label="Xóa thông báo"
                    >
                      <Trash size={16} aria-hidden="true" />
                    </button>
                    {!notif.read && <span className="notification-dot" />}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="profile-page">
      <div className="container">
        {/* Breadcrumbs */}
        <nav className="profile-breadcrumbs">
          <Link to="/">{tCommon.breadcrumb.home}</Link>
          <ChevronRight size={14} className="breadcrumb-separator" />
          <span className="current">{t.title}</span>
        </nav>

        {/* Loyalty Panel - Full Width at top */}
        <div className="loyalty-panel">
          <div className="loyalty-top">
            <div className="loyalty-left">
              <div className="loyalty-avatar">
                {user.avatar && /^https?:\/\//.test(user.avatar) ? (
                  <img src={user.avatar} alt={user.name} />
                ) : (
                  <span>{(user.name.charAt(0) || 'U').toUpperCase()}</span>
                )}
              </div>
              <div className="loyalty-welcome">
                <span className="welcome-text">Xin chào</span>
                <span className="welcome-name">{user.name}!</span>
              </div>
            </div>
            <div className="loyalty-stats">
              <div className="loyalty-stat">
                <span className="stat-label">Hạng thành viên</span>
                <span 
                  className="stat-value tier-badge" 
                  style={{ backgroundColor: tierConfig.bg, color: tierConfig.color, borderColor: tierConfig.color }}
                >
                  {tierConfig.label}
                </span>
              </div>
              <div className="loyalty-stat">
                <span className="stat-label">Điểm tích lũy</span>
                <span className="stat-value points">{user.points.toLocaleString('vi-VN')} điểm</span>
              </div>
            </div>
          </div>
          {nextTier && (
            <div className="loyalty-progress">
              <div className="progress-header">
                <span className="progress-label">Tiến đến {nextTier}</span>
                <span className="progress-percent">{Math.round(progress)}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%`, backgroundColor: tierConfig.color }} />
              </div>
              <span className="progress-detail">Còn {formatPrice(requiredForNext)} đ để thăng hạng</span>
            </div>
          )}
        </div>

        <div className="profile-layout">
          {/* Sidebar */}
          <aside className="profile-sidebar">
            <ul className="profile-nav-list">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const hasBadge = tab.badge && tab.badge > 0;
                return (
                  <li key={tab.id} className="profile-nav-item">
                    <button
                      className={`profile-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                      onClick={() => handleTabChange(tab.id as TabId)}
                    >
                      <Icon className="profile-nav-icon" />
                      {tab.label}
                      {hasBadge && <span className="notif-tab-badge">{tab.badge}</span>}
                    </button>
                  </li>
                );
              })}

              <li className="profile-nav-item mt-4 pt-4 border-t border-gray-200">
                <button className="profile-nav-btn text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleLogout}>
                  <LogOut className="profile-nav-icon" />
                  {t.logout}
                </button>
              </li>
            </ul>
          </aside>

          {/* Main Content */}
          <main className="profile-content">
            {isLoading ? (
              <div className="profile-loading">
                <Skeleton type="text" width="40%" height={32} />
                <div className="profile-loading-rows">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="profile-loading-row">
                      <Skeleton type="text" width="30%" />
                      <Skeleton type="text" width="50%" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              renderContent() || <div className="p-8 text-center text-red-500">Error rendering tab: {activeTab}</div>
            )}
          </main>
        </div>
      </div>

      {/* Account Update Modal */}
      {isAccountModalOpen && (
        <div className="profile-modal-overlay" onClick={() => setIsAccountModalOpen(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <div>
                <p className="profile-modal-eyebrow">Hồ sơ cá nhân</p>
                <h2>Cập nhật thông tin</h2>
              </div>
              <button className="profile-modal-close" onClick={() => setIsAccountModalOpen(false)} aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            
            <div className="profile-modal-body">
              <form className="profile-modal-form" onSubmit={handleAccountSubmit}>
                {/* Name Input */}
                <div className="modal-input-group">
                  <span className="modal-floating-label">Họ và tên</span>
                  <User className="modal-input-icon" size={18} aria-hidden="true" />
                  <input
                    type="text"
                    className="modal-input"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    autoComplete="name"
                    name="name"
                    required
                  />
                </div>
                
                {/* Phone Input */}
                <div className="modal-input-group">
                  <span className="modal-floating-label">Số điện thoại</span>
                  <div className="modal-input-icon">
                    <img src="https://flagcdn.com/w20/vn.png" alt="VN Flag" className="w-5 h-auto rounded-sm" />
                  </div>
                  <input
                    type="text"
                    className="modal-input"
                    value={accountPhone}
                    onChange={(e) => setAccountPhone(e.target.value)}
                  />
                </div>

                <div className="modal-flex-row gap-6 items-center">
                  <label className="modal-radio-label">
                    <input
                      type="radio"
                      name="gender"
                      value="MALE"
                      checked={accountGender === 'MALE'}
                      onChange={() => setAccountGender('MALE')}
                    />
                    <span className="radio-custom"></span>
                    Nam
                  </label>
                  <label className="modal-radio-label">
                    <input
                      type="radio"
                      name="gender"
                      value="FEMALE"
                      checked={accountGender === 'FEMALE'}
                      onChange={() => setAccountGender('FEMALE')}
                    />
                    <span className="radio-custom"></span>
                    Nữ
                  </label>
                  <label className="modal-radio-label">
                    <input
                      type="radio"
                      name="gender"
                      value="OTHER"
                      checked={accountGender === 'OTHER'}
                      onChange={() => setAccountGender('OTHER')}
                    />
                    <span className="radio-custom"></span>
                    Khác
                  </label>
                </div>

                <div className="modal-input-group">
                  <span className="modal-floating-label">Ngày sinh</span>
                  <input
                    type="date"
                    className="modal-input"
                    style={{ paddingLeft: '16px' }}
                    value={accountDateOfBirth}
                    onChange={(e) => setAccountDateOfBirth(e.target.value)}
                  />
                </div>
                
                {/* Height Slider */}
                <div className="modal-slider-group">
                  <span className="modal-slider-label">Chiều cao</span>
                  <input 
                    type="range" 
                    min="100" 
                    max="190" 
                    value={height} 
                    onChange={(e) => setHeight(e.target.value)}
                    className="modal-slider mx-4" 
                    style={{ '--val': `${((Number(height) - 100) / (190 - 100)) * 100}%` } as React.CSSProperties}
                  />
                  <span className="modal-slider-val text-co-black font-bold">{height}cm</span>
                </div>
                
                {/* Weight Slider */}
                <div className="modal-slider-group">
                  <span className="modal-slider-label">Cân nặng</span>
                  <input 
                    type="range" 
                    min="30" 
                    max="90" 
                    value={weight} 
                    onChange={(e) => setWeight(e.target.value)}
                    className="modal-slider mx-4" 
                    style={{ '--val': `${((Number(weight) - 30) / (90 - 30)) * 100}%` } as React.CSSProperties}
                  />
                  <span className="modal-slider-val text-co-black font-bold">{weight}kg</span>
                </div>
                
                <button type="submit" className="modal-submit-btn">
                  {isSavingProfile ? 'ĐANG CẬP NHẬT...' : 'CẬP NHẬT THÔNG TIN'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Password Update Modal */}
      {isPasswordModalOpen && (
        <div className="profile-modal-overlay" onClick={closePasswordModal}>
          <div className="profile-modal modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <div>
                <p className="profile-modal-eyebrow">Bảo mật</p>
                <h2>Đổi mật khẩu</h2>
              </div>
              <button className="profile-modal-close" onClick={closePasswordModal} aria-label="Đóng">
                <X size={18} />
              </button>
            </div>
            
            <div className="profile-modal-body">
              <form className="profile-modal-form" onSubmit={handlePasswordSubmit}>
                {/* Old Password */}
                <div className="modal-input-group">
                  <span className="modal-floating-label">Mật khẩu cũ</span>
                  <Lock className="modal-input-icon text-gray-400" size={18} />
                  <input 
                    type={showOldPassword ? "text" : "password"}
                    className="modal-input pr-10" 
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowOldPassword(!showOldPassword)} className="profile-modal-icon-btn" aria-label={showOldPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}>
                    {showOldPassword ? <EyeOff className="text-black" size={18} /> : <Eye className="text-black" size={18} />}
                  </button>
                </div>

                {/* New Password */}
                <div className="modal-input-group">
                  <span className="modal-floating-label hidden-if-empty">Mật khẩu mới</span>
                  <Lock className="modal-input-icon text-gray-300" size={18} />
                  <input 
                    type={showNewPassword ? "text" : "password"}
                    className="modal-input pr-10 text-gray-400" 
                    placeholder="Mật khẩu mới"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="profile-modal-icon-btn" aria-label={showNewPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}>
                    {showNewPassword ? <EyeOff className="text-black" size={18} /> : <Eye className="text-black" size={18} />}
                  </button>
                </div>

                {/* Confirm Password */}
                <div className="modal-input-group">
                  <span className="modal-floating-label hidden-if-empty">Nhập lại mật khẩu</span>
                  <Lock className="modal-input-icon text-gray-300" size={18} />
                  <input 
                    type={showConfirmPassword ? "text" : "password"}
                    className="modal-input pr-10 text-gray-400" 
                    placeholder="Nhập lại mật khẩu"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="profile-modal-icon-btn" aria-label={showConfirmPassword ? "Ẩn mật khẩu" : "Hiển thị mật khẩu"}>
                    {showConfirmPassword ? <EyeOff className="text-black" size={18} /> : <Eye className="text-black" size={18} />}
                  </button>
                </div>

                <button type="submit" className="modal-submit-btn">
                  {isChangingPassword ? 'ĐANG CẬP NHẬT...' : 'CẬP NHẬT MẬT KHẨU'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Address Modal */}
      <AddressModal
        isOpen={isAddressModalOpen}
        onClose={handleCloseAddressModal}
        onSave={loadAddresses}
        editingAddress={editingAddress}
      />
      {/* Review Modal */}
      {reviewProduct && (
        <ReviewModal
          isOpen={isReviewModalOpen}
          onClose={handleCloseReviewModal}
          product={reviewProduct}
        />
      )}
    </div>
  );
};

export default Profile;
