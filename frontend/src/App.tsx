import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import './App.css';

// Lazy loaded pages
const Home = lazy(() => import('./pages/Home/Home'));
const ProductListing = lazy(() => import('./pages/ProductListing/ProductListing'));
const ProductDetail = lazy(() => import('./pages/ProductDetail/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart/Cart'));
const Checkout = lazy(() => import('./pages/Checkout/Checkout'));
const Profile = lazy(() => import('./pages/Profile/Profile'));
const VendorRegister = lazy(() => import('./pages/VendorRegister/VendorRegister'));
const NotFound = lazy(() => import('./pages/NotFound/NotFound'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess/OrderSuccess'));
const Search = lazy(() => import('./pages/Search/Search'));
const Wishlist = lazy(() => import('./pages/Wishlist/Wishlist'));
const Policy = lazy(() => import('./pages/Policy/Policy'));
const About = lazy(() => import('./pages/About/About'));
const Contact = lazy(() => import('./pages/Contact/Contact'));
const OrderDetail = lazy(() => import('./pages/OrderDetail/OrderDetail'));
const ScrollToTop = lazy(() => import('./components/ScrollToTop/ScrollToTop'));
const OrdersPage = lazy(() => import('./pages/Account/OrdersPage'));
const AddressesPage = lazy(() => import('./pages/Account/AddressesPage'));
const SecurityPage = lazy(() => import('./pages/Account/SecurityPage'));
const OrderDetailPage = lazy(() => import('./pages/Account/OrderDetailPage'));
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute/ProtectedRoute'));
const OrderTracking = lazy(() => import('./pages/OrderTracking/OrderTracking'));
const Returns = lazy(() => import('./pages/Returns/Returns'));
const FAQ = lazy(() => import('./pages/FAQ/FAQ'));
const PaymentResult = lazy(() => import('./pages/PaymentResult/PaymentResult'));
const SizeGuide = lazy(() => import('./pages/SizeGuide/SizeGuide'));
const StoreProfile = lazy(() => import('./pages/StoreProfile/StoreProfile'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));

// Admin pages
import AdminWorkspace from './pages/Admin/AdminWorkspace';

// Vendor Portal
import VendorWorkspace from './pages/Vendor/VendorWorkspace';

// Core components (not lazy loaded - needed immediately)
import TopBar from './components/TopBar/TopBar';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import { ToastProvider } from './contexts/ToastContext';
import { CartAnimationProvider } from './context/CartAnimationContext';
import { WishlistProvider } from './contexts/WishlistContext';
import { CartProvider } from './contexts/CartContext';
import { FilterProvider } from './contexts/FilterContext';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import ChatWidget from './components/ChatWidget/ChatWidget';

const MainLayout = () => {
  const location = useLocation();
  const isCheckout = location.pathname === '/checkout';
  const isAdmin = location.pathname.startsWith('/admin');
  const isVendorPortal = location.pathname.startsWith('/vendor/') && !location.pathname.startsWith('/vendor/register');

  return (
    <>
      {!isAdmin && !isVendorPortal && <TopBar />}
      {!isAdmin && !isVendorPortal && <Header />}
      <Outlet />
      {!isCheckout && !isAdmin && !isVendorPortal && <Footer />}
      {!isCheckout && !isAdmin && !isVendorPortal && <ChatWidget />}
    </>
  );
};

const RouteLoader = ({ children, text }: { children: React.ReactNode; text?: string }) => (
  <Suspense fallback={<LoadingSpinner size="lg" fullScreen text={text || 'Đang tải...'} />}>
    {children}
  </Suspense>
);

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <CartAnimationProvider>
            <WishlistProvider>
              <FilterProvider>
                <NotificationProvider>
                <Router>
                  <RouteLoader>
                    <ScrollToTop />
                    <div className="app-container">
                      <Routes>
                        {/* All routes share standard layout (Header, Footer) */}
                        <Route element={<MainLayout />}>
                          <Route path="/" element={<Home />} />
                          <Route path="/category/:id" element={<ProductListing />} />
                          <Route path="/product/:id" element={<ProductDetail />} />
                          <Route path="/cart" element={<Cart />} />
                          <Route path="/checkout" element={<Checkout />} />
                          <Route path="/login" element={<Login />} />
                          <Route path="/register" element={<Register />} />
                          <Route path="/forgot" element={<ForgotPassword />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/vendor/register" element={<VendorRegister />} />
                          <Route path="/order-success" element={<OrderSuccess />} />
                          <Route path="/search" element={<Search />} />
                          <Route path="/wishlist" element={<Wishlist />} />
                          <Route path="/order-tracking" element={<OrderTracking />} />
                          <Route path="/returns" element={<Returns />} />
                          <Route path="/payment-result" element={<PaymentResult />} />
                          <Route path="/faq" element={<FAQ />} />
                          <Route path="/size-guide" element={<SizeGuide />} />
                          <Route path="/store/:slug" element={<StoreProfile />} />
                          <Route path="/policy/:type" element={<Policy />} />
                          <Route path="/about" element={<About />} />
                          <Route path="/contact" element={<Contact />} />
                          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                          <Route path="/profile/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
                          <Route path="/account/orders" element={<ProtectedRoute><OrdersPage /></ProtectedRoute>} />
                          <Route path="/account/orders/:id" element={<ProtectedRoute><OrderDetailPage /></ProtectedRoute>} />
                          <Route path="/account/addresses" element={<ProtectedRoute><AddressesPage /></ProtectedRoute>} />
                          <Route path="/account/security" element={<ProtectedRoute><SecurityPage /></ProtectedRoute>} />
                          <Route path="*" element={<NotFound />} />
                        </Route>

                        {/* Admin routes - SUPER_ADMIN only */}
                        <Route
                          path="/admin/*"
                          element={(
                            <ProtectedRoute
                              allowedRoles={['SUPER_ADMIN']}
                              redirectUnauthenticatedToLogin
                              redirectUnauthorizedToLogin
                              animation="none"
                            >
                              <AdminWorkspace />
                            </ProtectedRoute>
                          )}
                        />



                        {/* Vendor Portal routes - VENDOR only */}
                        <Route
                          path="/vendor/*"
                          element={(
                            <ProtectedRoute
                              allowedRoles={['VENDOR']}
                              requireVendorApproval
                              redirectUnauthenticatedToLogin
                              redirectUnauthorizedToLogin
                              animation="none"
                            >
                              <VendorWorkspace />
                            </ProtectedRoute>
                          )}
                        />
                      </Routes>
                    </div>
                  </RouteLoader>
                </Router>
              </NotificationProvider>
              </FilterProvider>
            </WishlistProvider>
          </CartAnimationProvider>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
