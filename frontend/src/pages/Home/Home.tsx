import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Store } from 'lucide-react';
import './Home.css';
import HeroSlider from '../../components/HeroSlider/HeroSlider';
import Categories from '../../components/Categories/Categories';
import ProductSection from '../../components/ProductSection/ProductSection';
import FlashSaleSection, { type FlashSaleItem } from '../../components/FlashSaleSection/FlashSaleSection';
import { mensFashion, womensFashion } from '../../mocks/products';
import Skeleton from '../../components/Skeleton/Skeleton';
import {
  marketplaceService,
  type MarketplaceStoreCard,
  type MarketplaceHomeCategoryTab,
} from '../../services/marketplaceService';
import { useCart } from '../../contexts/CartContext';

interface HomeSectionProduct {
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
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  isOfficialStore?: boolean;
  stock?: number;
  soldCount?: number;
  totalStock?: number;
}

const fallbackFeaturedProducts: HomeSectionProduct[] = mensFashion.map((product) => ({ ...product }));
const fallbackTrendingProducts: HomeSectionProduct[] = womensFashion.map((product) => ({ ...product }));

const fallbackTopVendors: MarketplaceStoreCard[] = [
  {
    id: 'store-coolmate-mall',
    name: 'Coolmate Mall',
    storeCode: 'SHOP-CM-001',
    slug: 'coolmate-mall',
    logo: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=200&auto=format&fit=crop',
    rating: 4.9,
    totalOrders: 12450,
    liveProductCount: 380,
  },
  {
    id: 'store-thinh-fashion',
    name: 'Th\u1ecbnh Fashion Shop',
    storeCode: 'SHOP-TF-028',
    slug: 'thinh-fashion',
    logo: 'https://images.unsplash.com/photo-1503341455253-b2e723bb3dbb?q=80&w=200&auto=format&fit=crop',
    rating: 4.8,
    totalOrders: 8520,
    liveProductCount: 211,
  },
  {
    id: 'store-mina-boutique',
    name: 'Mina Boutique',
    storeCode: 'SHOP-MB-104',
    slug: 'mina-boutique',
    logo: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=200&auto=format&fit=crop',
    rating: 4.7,
    totalOrders: 6150,
    liveProductCount: 174,
  },
  {
    id: 'store-athleisure-pro',
    name: 'Athleisure Pro',
    storeCode: 'SHOP-AP-233',
    slug: 'athleisure-pro',
    logo: 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=200&auto=format&fit=crop',
    rating: 4.8,
    totalOrders: 7040,
    liveProductCount: 145,
  },
];

const Home = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [featuredStores, setFeaturedStores] = useState<MarketplaceStoreCard[]>([]);
  const [categoryTabs, setCategoryTabs] = useState<MarketplaceHomeCategoryTab[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<HomeSectionProduct[]>(fallbackFeaturedProducts);
  const [trendingProducts, setTrendingProducts] = useState<HomeSectionProduct[]>(fallbackTrendingProducts);
  const { addToCart } = useCart();

  useEffect(() => {
    let mounted = true;

    const loadHomeData = async () => {
      try {
        const data = await marketplaceService.getHomeData();
        if (!mounted) return;

        setFeaturedStores(data.featuredStores);
        setCategoryTabs(data.categoryTabs || []);
        setFeaturedProducts(data.featuredProducts.length > 0 ? data.featuredProducts : fallbackFeaturedProducts);
        setTrendingProducts(data.trendingProducts.length > 0 ? data.trendingProducts : fallbackTrendingProducts);
      } catch {
        if (!mounted) return;
        setFeaturedStores([]);
        setCategoryTabs([]);
        setFeaturedProducts(fallbackFeaturedProducts);
        setTrendingProducts(fallbackTrendingProducts);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadHomeData();
    return () => {
      mounted = false;
    };
  }, []);

  const flashSaleProducts = useMemo(() => {
    const uniqueById = new Map<string, HomeSectionProduct>();
    [...featuredProducts, ...trendingProducts].forEach((product) => {
      uniqueById.set(String(product.id), product);
    });

    const discountedProducts = [...uniqueById.values()].filter(
      (product) => typeof product.originalPrice === 'number' && product.originalPrice > product.price,
    );

    if (discountedProducts.length > 0) {
      return discountedProducts.slice(0, 12);
    }

    return featuredProducts.slice(0, 12);
  }, [featuredProducts, trendingProducts]);

  const flashSaleItems = useMemo<FlashSaleItem[]>(
    () =>
      flashSaleProducts.map((product) => {
        const availableStock = Math.max(0, Number(product.stock || 0));
        const soldCountFromApi = typeof product.soldCount === 'number' ? Math.max(0, Math.round(product.soldCount)) : 0;
        const totalStockFromApi = typeof product.totalStock === 'number' ? Math.max(1, Math.round(product.totalStock)) : 0;

        const totalStock = totalStockFromApi > 0 ? totalStockFromApi : Math.max(1, soldCountFromApi + availableStock);
        const soldCount = Math.min(totalStock, soldCountFromApi);

        return {
          id: product.id,
          backendProductId: product.backendId,
          name: product.name,
          image: product.image,
          price: product.price,
          originalPrice: product.originalPrice,
          storeName: product.storeName || 'Nh\u00e0 b\u00e1n',
          storeId: product.storeId,
          isOfficialStore: product.isOfficialStore,
          soldCount,
          totalStock,
        };
      }),
    [flashSaleProducts],
  );

  const topVendors = useMemo(() => {
    if (featuredStores.length > 0) {
      return featuredStores.slice(0, 4);
    }
    return fallbackTopVendors;
  }, [featuredStores]);

  const handleQuickAddFlashItem = (item: FlashSaleItem) => {
    addToCart({
      id: item.id,
      backendProductId: item.backendProductId,
      name: item.name,
      price: item.price,
      originalPrice: item.originalPrice,
      image: item.image,
      color: 'M\u1eb7c \u0111\u1ecbnh',
      size: 'M',
      storeId: item.storeId || 'default-store',
      storeName: item.storeName || 'C\u1eeda h\u00e0ng',
      isOfficialStore: Boolean(item.isOfficialStore),
    });
  };

  return (
    <div className="home-page">
      <main className="main-content">
        {isLoading ? (
          <div className="home-loading">
            <div className="hero-skeleton">
              <Skeleton type="rectangular" height={500} />
            </div>
            <div className="categories-skeleton">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} type="circular" width={80} height={80} />
              ))}
            </div>
            <div className="product-section-skeleton">
              <Skeleton type="text" width={240} height={28} />
              <div className="product-grid-skeleton">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                  <div key={i} className="product-card-skeleton">
                    <Skeleton type="rectangular" height={280} />
                    <Skeleton type="text" width="80%" />
                    <Skeleton type="text" width="40%" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <HeroSlider />
            <Categories
              categoryTabs={categoryTabs}
              featuredStores={featuredStores}
              showFeaturedStores={false}
            />

            <div className="home-section-gap">
              <FlashSaleSection
                items={flashSaleItems}
                onQuickAdd={handleQuickAddFlashItem}
              />
            </div>

            <div className="home-section-gap container">
              <section className="top-vendor-section">
                <div className="top-vendor-head">
                  <div className="top-vendor-title-wrap">
                    <span className="top-vendor-eyebrow">
                      <Store size={14} />
                      {'Nh\u00e0 b\u00e1n uy t\u00edn'}
                    </span>
                    <h2>{'Nh\u00e0 b\u00e1n n\u1ed5i b\u1eadt tr\u00ean s\u00e0n'}</h2>
                  </div>
                  <Link to="/search?scope=stores" className="top-vendor-view-all">
                    {'Xem t\u1ea5t c\u1ea3'}
                  </Link>
                </div>

                <div className="top-vendor-grid">
                  {topVendors.map((store) => (
                    <Link key={store.id} to={`/store/${store.slug}`} className="top-vendor-card">
                      <img src={store.logo} alt={store.name} className="top-vendor-logo" />
                      <div className="top-vendor-meta">
                        <span className="top-vendor-code">{store.storeCode}</span>
                        <span className="top-vendor-name">{store.name}</span>
                        <div className="top-vendor-stats">
                          <span className="top-vendor-rating">
                            <Star size={12} fill="currentColor" />
                            {store.rating.toFixed(1)}
                          </span>
                          <span className="top-vendor-stat-item">{store.totalOrders.toLocaleString('vi-VN')} {'\u0111\u01a1n'}</span>
                          <span className="top-vendor-stat-item">{store.liveProductCount.toLocaleString('vi-VN')} SP</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            </div>

            <div className="home-section-gap">
              <ProductSection
                title={'G\u1ee2I \u00dd H\u00d4M NAY'}
                products={trendingProducts}
                viewAllLink="/search?scope=products"
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Home;
