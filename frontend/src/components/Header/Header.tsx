import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Heart, Menu, X, ChevronDown, Bell, Store, LayoutGrid } from 'lucide-react';
import SearchDropdown from '../SearchDropdown/SearchDropdown';
import NotificationDropdown from '../NotificationDropdown/NotificationDropdown';
import { useCartAnimation } from '../../context/CartAnimationContext';
import { useCart } from '../../contexts/CartContext';
import { useWishlist } from '../../contexts/WishlistContext';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { searchService } from '../../services/searchService';
import { CLIENT_TEXT } from '../../utils/texts';
import { CLIENT_TOAST_MESSAGES } from '../../utils/clientMessages';
import './Header.css';

const Header = () => {
  const navigate = useNavigate();
  const { totalItems } = useCart();
  const { totalItems: wishlistCount } = useWishlist();
  const { cartIconRef, wishlistIconRef } = useCartAnimation();
  const [searchValue, setSearchValue] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [expandedMobileMenu, setExpandedMobileMenu] = useState<string | null>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const { addToast } = useToast();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const { unreadCount } = useNotifications();

  const toggleMobileSubMenu = (menuId: string) => {
    setExpandedMobileMenu(prev => prev === menuId ? null : menuId);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setExpandedMobileMenu(null);
  };

  // Pulse animation state
  const [isBouncing, setIsBouncing] = useState(false);
  const prevItemsRef = React.useRef(totalItems);

  React.useEffect(() => {
    if (totalItems > prevItemsRef.current) {
      setIsBouncing(true);
      setTimeout(() => setIsBouncing(false), 300);
    }
    prevItemsRef.current = totalItems;
  }, [totalItems]);

const handleSearchSubmit = (query: string) => {
    if (query.trim()) {
      searchService.addToHistory(query);
      setSearchValue(query);
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setIsSearchDropdownOpen(false);
    }
  };

  return (
    <header className="header">
      <div className="header-container container">
        {/* Logo */}
        <div className="header-logo">
          <Link to="/">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className="logo-icon">
              <path fillRule="evenodd" clipRule="evenodd" d="M16 0H24V16H40V24H24V40H16V24H0V16H16V0Z" fill="black" />
            </svg>
            <span className="logo-text">
              COOL<span className="logo-mate">MATE</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="header-nav">
          <ul className="nav-list">
            <li><Link to="/category/new" className="nav-link nav-new">NEW</Link></li>
            <li className="nav-item has-mega-menu">
              <Link to="/category/men" className="nav-link">NAM</Link>
              <div className="mega-menu">
                <div className="mega-menu-content">
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">ÁO</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/men-ao-thun">Áo thun</Link></li>
                      <li><Link to="/category/men-ao-polo">Áo polo</Link></li>
                      <li><Link to="/category/men-ao-so-mi">Áo sơ mi</Link></li>
                      <li><Link to="/category/men-ao-hoodie">Áo hoodie</Link></li>
                      <li><Link to="/category/men-ao-len">Áo len</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">QUẦN</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/men-quan-jeans">Quần jeans</Link></li>
                      <li><Link to="/category/men-quan-tay">Quần tay</Link></li>
                      <li><Link to="/category/men-quan-kaki">Quần kaki</Link></li>
                      <li><Link to="/category/men-quan-short">Quần short</Link></li>
                      <li><Link to="/category/men-quan-jogger">Quần jogger</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">ĐỒ THỂ THAO</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/men-ao-the-thao">Áo thể thao</Link></li>
                      <li><Link to="/category/men-quan-the-thao">Quần thể thao</Link></li>
                      <li><Link to="/category/men-set-the-thao">Set thể thao</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">ĐỒ MẶC NHÀ</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/men-ao-mac-nha">Áo mặc nhà</Link></li>
                      <li><Link to="/category/men-quan-mac-nha">Quần mặc nhà</Link></li>
                      <li><Link to="/category/men-bo-mac-nha">Bộ mặc nhà</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">PHỤ KIỆN</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/men-non-mu">Nón / mũ</Link></li>
                      <li><Link to="/category/men-that-lung">Thắt lưng</Link></li>
                      <li><Link to="/category/men-vi">Ví</Link></li>
                      <li><Link to="/category/men-tat">Tất</Link></li>
                    </ul>
                  </div>
                </div>
              </div>
            </li>

            <li className="nav-item has-mega-menu">
              <Link to="/category/women" className="nav-link">NỮ</Link>
              <div className="mega-menu">
                <div className="mega-menu-content">
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">ÁO</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/women-ao-thun">Áo thun</Link></li>
                      <li><Link to="/category/women-ao-kieu">Áo kiểu</Link></li>
                      <li><Link to="/category/women-ao-so-mi">Áo sơ mi</Link></li>
                      <li><Link to="/category/women-ao-croptop">Áo croptop</Link></li>
                      <li><Link to="/category/women-ao-khoac">Áo khoác</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">VÁY / ĐẦM</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/women-vay-lien">Váy liền</Link></li>
                      <li><Link to="/category/women-vay-du-tiec">Váy dự tiệc</Link></li>
                      <li><Link to="/category/women-vay-cong-so">Váy công sở</Link></li>
                      <li><Link to="/category/women-vay-maxi">Váy maxi</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">QUẦN</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/women-quan-jeans">Quần jeans</Link></li>
                      <li><Link to="/category/women-quan-short">Quần short</Link></li>
                      <li><Link to="/category/women-quan-tay">Quần tay</Link></li>
                      <li><Link to="/category/women-quan-legging">Quần legging</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">ĐỒ THỂ THAO</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/women-ao-the-thao">Áo thể thao</Link></li>
                      <li><Link to="/category/women-quan-the-thao">Quần thể thao</Link></li>
                      <li><Link to="/category/women-set-the-thao">Set thể thao</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">ĐỒ MẶC NHÀ</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/women-ao-mac-nha">Áo mặc nhà</Link></li>
                      <li><Link to="/category/women-quan-mac-nha">Quần mặc nhà</Link></li>
                      <li><Link to="/category/women-bo-mac-nha">Bộ mặc nhà</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">PHỤ KIỆN</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/women-tui-xach">Túi xách</Link></li>
                      <li><Link to="/category/women-non-mu">Nón / mũ</Link></li>
                      <li><Link to="/category/women-khan">Khăn</Link></li>
                      <li><Link to="/category/women-that-lung">Thắt lưng</Link></li>
                    </ul>
                  </div>
                </div>
              </div>
            </li>
            <li className="nav-item has-mega-menu">
              <Link to="/category/accessories" className="nav-link">PHỤ KIỆN</Link>
              <div className="mega-menu">
                <div className="mega-menu-content">
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">Túi & ví</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/tui-xach">Túi xách</Link></li>
                      <li><Link to="/category/tui-deo-cheo">Túi đeo chéo</Link></li>
                      <li><Link to="/category/balo">Balo</Link></li>
                      <li><Link to="/category/vi">Ví</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">Phụ kiện thời trang</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/non-mu">Nón / mũ</Link></li>
                      <li><Link to="/category/that-lung">Thắt lưng</Link></li>
                      <li><Link to="/category/khan">Khăn</Link></li>
                      <li><Link to="/category/tat">Tất</Link></li>
                    </ul>
                  </div>
                  <div className="mega-menu-col">
                    <h3 className="mega-menu-title">Phụ kiện khác (tuỳ shop)</h3>
                    <ul className="mega-menu-list">
                      <li><Link to="/category/kinh-mat">Kính mát</Link></li>
                      <li><Link to="/category/dong-ho">Đồng hồ</Link></li>
                      <li><Link to="/category/trang-suc">Trang sức</Link></li>
                    </ul>
                  </div>
                </div>
              </div>
            </li>
            <li>
              <Link to="/category/sale" className="nav-link nav-sale">
                <div className="sale-content">
                  <span className="sale-percent">-50%</span>
                  <span className="sale-label">SALE</span>
                </div>
              </Link>
            </li>
          </ul>
        </nav>

        {/* Actions */}
        <div className="header-actions">
          <form className="search-box" onSubmit={(e) => { e.preventDefault(); handleSearchSubmit(searchValue); }}>
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder={CLIENT_TEXT.search.dropdown.placeholder}
              className="search-input"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onFocus={() => setIsSearchDropdownOpen(true)}
              aria-label={CLIENT_TEXT.common.actions.search}
            />
            <SearchDropdown
              isOpen={isSearchDropdownOpen}
              onClose={() => setIsSearchDropdownOpen(false)}
              inputValue={searchValue}
              onSearch={handleSearchSubmit}
            />
          </form>
          <div className="auth-links">
            {!isAuthenticated ? (
              <div className="auth-links">
                <Link to="/login" className="auth-link">Đăng nhập</Link>
                <span className="auth-divider">/</span>
                <Link to="/register" className="auth-link">Đăng ký</Link>
              </div>
            ) : (
              <div 
                className="account-menu"
                onMouseEnter={() => setIsAccountMenuOpen(true)}
                onMouseLeave={() => setIsAccountMenuOpen(false)}
              >
                <button
                  className="account-toggle"
                  onClick={() => navigate('/profile')}
                >
                  <div className="account-avatar">
                    {user?.avatar || user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="account-name">{user?.name || 'Tài khoản'}</span>
                </button>
                <div className={`account-dropdown ${isAccountMenuOpen ? 'show' : ''}`}>
                  <button className="account-item" onClick={() => { navigate('/profile'); setIsAccountMenuOpen(false); }}>
                    {CLIENT_TEXT.profile.tabs.account}
                  </button>
                  <button className="account-item" onClick={() => { navigate('/profile?tab=orders'); setIsAccountMenuOpen(false); }}>
                    {CLIENT_TEXT.profile.tabs.orders}
                  </button>
                  <button className="account-item" onClick={() => { navigate('/profile?tab=vouchers'); setIsAccountMenuOpen(false); }}>
                    {CLIENT_TEXT.profile.tabs.vouchers}
                  </button>
                  <button className="account-item" onClick={() => { navigate('/profile?tab=addresses'); setIsAccountMenuOpen(false); }}>
                    {CLIENT_TEXT.profile.tabs.addresses}
                  </button>
                  <button className="account-item" onClick={() => { navigate('/profile?tab=reviews'); setIsAccountMenuOpen(false); }}>
                    {CLIENT_TEXT.profile.tabs.reviews}
                  </button>
                  
                  {/* Portal Switcher - Apple/Stripe Style */}
                  {(user?.role === 'VENDOR' || user?.role === 'SUPER_ADMIN') && (
                    <>
                      <div className="account-dropdown-divider"></div>
                      <div className="portal-switcher-label">Chuyển kênh</div>
                      {user?.role === 'VENDOR' && (
                        <button className="account-item portal-item" onClick={() => { navigate('/vendor/dashboard'); setIsAccountMenuOpen(false); }}>
                          <span className="portal-icon">🏪</span>
                          <span>Kênh Người Bán</span>
                          {!user?.isApprovedVendor && <span className="portal-badge pending">Chờ duyệt</span>}
                        </button>
                      )}
                      {user?.role === 'SUPER_ADMIN' && (
                        <button className="account-item portal-item" onClick={() => { navigate('/admin'); setIsAccountMenuOpen(false); }}>
                          <span className="portal-icon">⚡</span>
                          <span>Quản Trị Sàn</span>
                        </button>
                      )}
                    </>
                  )}
                  
                  <div className="account-dropdown-divider"></div>
                  <button className="account-item logout" onClick={() => { logout(); addToast(CLIENT_TOAST_MESSAGES.auth.logoutSuccess, 'info'); setIsAccountMenuOpen(false); navigate('/'); }}>
                    Đăng xuất
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Portal Quick Access - For VENDOR/SUPER_ADMIN */}
          {isAuthenticated && (user?.role === 'VENDOR' || user?.role === 'SUPER_ADMIN') && (
            <button
              className={`portal-quick-btn ${user?.role?.toLowerCase()}`}
              onClick={() => navigate(user?.role === 'SUPER_ADMIN' ? '/admin' : '/vendor/dashboard')}
              title={user?.role === 'SUPER_ADMIN' ? 'Quản trị sàn' : 'Kênh người bán'}
            >
              {user?.role === 'SUPER_ADMIN' ? <LayoutGrid size={18} /> : <Store size={18} />}
            </button>
          )}
          
          <button ref={wishlistIconRef} className="icon-btn wishlist-btn" aria-label="Yêu thích" onClick={() => navigate('/wishlist')}>
            <Heart size={22} />
            {wishlistCount > 0 && <span className="icon-badge">{wishlistCount > 99 ? '99+' : wishlistCount}</span>}
          </button>
          {isAuthenticated && (
            <button 
              className="icon-btn notification-btn" 
              aria-label="Thông báo"
              onClick={() => setIsNotificationOpen(true)}
            >
              <Bell size={22} />
              {unreadCount > 0 && <span className="icon-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
            </button>
          )}
          <NotificationDropdown 
            isOpen={isNotificationOpen} 
            onClose={() => setIsNotificationOpen(false)} 
          />
          <button
            ref={cartIconRef}
            className={`icon-btn cart-btn ${isBouncing ? 'icon-bounce' : ''}`} 
            aria-label="Giỏ hàng" 
            onClick={() => navigate('/cart')}
          >
            <ShoppingCart size={22} />
            {totalItems > 0 && <span className="icon-badge">{totalItems > 99 ? '99+' : totalItems}</span>}
          </button>
        </div>
        {/* Mobile Menu Button */}
          <button className="mobile-menu-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} aria-label="Menu">
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && <button className="mobile-overlay" onClick={closeMobileMenu} aria-label="Đóng menu" />}

      {/* Mobile Drawer */}
      <div className={`mobile-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        {/* Mobile Search */}
        <form className="mobile-search" onSubmit={(e) => { e.preventDefault(); if (searchValue.trim()) { navigate(`/search?q=${encodeURIComponent(searchValue.trim())}`); closeMobileMenu(); } }}>
          <Search size={18} />
          <input type="text" placeholder="Tìm kiếm sản phẩm..." value={searchValue} onChange={e => setSearchValue(e.target.value)} />
        </form>

        {/* Mobile Nav */}
        <nav className="mobile-nav">
          <Link to="/category/new" className="mobile-nav-link mobile-new" onClick={closeMobileMenu}>NEW</Link>
          
          <div className="mobile-nav-group">
            <button className="mobile-nav-link" onClick={() => toggleMobileSubMenu('men')} aria-label="Danh mục Nam">
              NAM <ChevronDown size={16} className={expandedMobileMenu === 'men' ? 'rotated' : ''} aria-hidden="true" />
            </button>
            {expandedMobileMenu === 'men' && (
              <div className="mobile-sub-menu">
                <Link to="/category/men" onClick={closeMobileMenu}>Tất cả sản phẩm Nam</Link>
                <Link to="/category/men-ao-thun" onClick={closeMobileMenu}>Áo thun</Link>
                <Link to="/category/men-ao-polo" onClick={closeMobileMenu}>Áo polo</Link>
                <Link to="/category/men-quan-jeans" onClick={closeMobileMenu}>Quần jeans</Link>
                <Link to="/category/men-quan-short" onClick={closeMobileMenu}>Quần short</Link>
                <Link to="/category/men-ao-hoodie" onClick={closeMobileMenu}>Áo hoodie</Link>
              </div>
            )}
          </div>

          <div className="mobile-nav-group">
            <button className="mobile-nav-link" onClick={() => toggleMobileSubMenu('women')} aria-label="Danh mục Nữ">
              NỮ <ChevronDown size={16} className={expandedMobileMenu === 'women' ? 'rotated' : ''} aria-hidden="true" />
            </button>
            {expandedMobileMenu === 'women' && (
              <div className="mobile-sub-menu">
                <Link to="/category/women" onClick={closeMobileMenu}>Tất cả sản phẩm Nữ</Link>
                <Link to="/category/women-ao-thun" onClick={closeMobileMenu}>Áo thun</Link>
                <Link to="/category/women-vay-lien" onClick={closeMobileMenu}>Váy liền</Link>
                <Link to="/category/women-quan-jeans" onClick={closeMobileMenu}>Quần jeans</Link>
                <Link to="/category/women-ao-khoac" onClick={closeMobileMenu}>Áo khoác</Link>
              </div>
            )}
          </div>

          <div className="mobile-nav-group">
            <button className="mobile-nav-link" onClick={() => toggleMobileSubMenu('acc')} aria-label="Danh mục Phụ kiện">
              PHỤ KIỆN <ChevronDown size={16} className={expandedMobileMenu === 'acc' ? 'rotated' : ''} aria-hidden="true" />
            </button>
            {expandedMobileMenu === 'acc' && (
              <div className="mobile-sub-menu">
                <Link to="/category/accessories" onClick={closeMobileMenu}>Tất cả phụ kiện</Link>
                <Link to="/category/tui-xach" onClick={closeMobileMenu}>Túi xách</Link>
                <Link to="/category/non-mu" onClick={closeMobileMenu}>Nón / mũ</Link>
                <Link to="/category/that-lung" onClick={closeMobileMenu}>Thắt lưng</Link>
              </div>
            )}
          </div>

          <Link to="/category/sale" className="mobile-nav-link mobile-sale" onClick={closeMobileMenu}>🔥 SALE -50%</Link>
        </nav>

        {/* Mobile Auth */}
        <div className="mobile-auth">
          {!isAuthenticated ? (
            <>
              <button className="mobile-auth-btn" onClick={() => { navigate('/login'); closeMobileMenu(); }}>Đăng nhập</button>
              <button className="mobile-auth-btn mobile-auth-register" onClick={() => { navigate('/register'); closeMobileMenu(); }}>Đăng ký</button>
            </>
          ) : (
            <>
              <div className="mobile-user-info">
                <div className="mobile-user-avatar">
                  {user?.avatar || user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="mobile-user-details">
                  <span className="mobile-user-name">{user?.name}</span>
                  <span className="mobile-user-email">{user?.email}</span>
                </div>
              </div>
              <Link to="/profile" className="mobile-auth-btn" onClick={closeMobileMenu}>Tài khoản</Link>
              {user?.role === 'VENDOR' && (
                <Link to="/vendor/dashboard" className="mobile-auth-btn mobile-auth-admin" onClick={closeMobileMenu}>🏪 Kênh Người Bán</Link>
              )}
              {user?.role === 'SUPER_ADMIN' && (
                <Link to="/admin" className="mobile-auth-btn mobile-auth-admin" onClick={closeMobileMenu}>⚡ Quản Trị Sàn</Link>
              )}
              <button className="mobile-auth-btn mobile-auth-register" onClick={() => { logout(); addToast(CLIENT_TOAST_MESSAGES.auth.logoutSuccess, 'info'); closeMobileMenu(); }}>Đăng xuất</button>
            </>
          )}
        </div>

        {/* Mobile Quick Links */}
        <div className="mobile-quick-links">
          <Link to="/wishlist" onClick={closeMobileMenu}><Heart size={18} /> Yêu thích {wishlistCount > 0 && `(${wishlistCount})`}</Link>
          <Link to={isAuthenticated ? '/profile?tab=orders' : '/login'} onClick={closeMobileMenu}><Search size={18} /> Đơn hàng</Link>
          <Link to="/order-tracking" onClick={closeMobileMenu}><Search size={18} /> Theo dõi đơn</Link>
          <Link to="/returns" onClick={closeMobileMenu}><Search size={18} /> Đổi / Trả hàng</Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
