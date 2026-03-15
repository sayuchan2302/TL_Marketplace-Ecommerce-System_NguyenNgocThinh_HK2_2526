import { BrowserRouter as Router, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import './App.css';
import Home from './pages/Home/Home';
import TopBar from './components/TopBar/TopBar';
import Header from './components/Header/Header';
import Footer from './components/Footer/Footer';
import ProductListing from './pages/ProductListing/ProductListing';
import ProductDetail from './pages/ProductDetail/ProductDetail';
import Cart from './pages/Cart/Cart';
import Checkout from './pages/Checkout/Checkout';
import Profile from './pages/Profile/Profile';
import ScrollToTop from './components/ScrollToTop/ScrollToTop';
import { CartAnimationProvider } from './context/CartAnimationContext';

const MainLayout = () => {
  const location = useLocation();
  const isCheckout = location.pathname === '/checkout';

  return (
    <>
      <TopBar />
      <Header />
      <Outlet />
      {!isCheckout && <Footer />}
    </>
  );
};

function App() {
  return (
    <CartAnimationProvider>
      <Router>
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
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Routes>
        </div>
      </Router>
    </CartAnimationProvider>
  );
}

export default App;
