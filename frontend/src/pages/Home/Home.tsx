import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, Store } from 'lucide-react';
import './Home.css';
import HeroSlider from '../../components/HeroSlider/HeroSlider';
import Categories from '../../components/Categories/Categories';
import ProductSection from '../../components/ProductSection/ProductSection';
import FlashSaleSection, { type FlashSaleItem } from '../../components/FlashSaleSection/FlashSaleSection';
import Skeleton from '../../components/Skeleton/Skeleton';
import {
  marketplaceService,
  type MarketplaceStoreCard,
  type MarketplaceHomeCategoryTab,
} from '../../services/marketplaceService';
import { productService } from '../../services/productService';

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
  variants?: Array<{
    color: string;
    size: string;
    backendId?: string;
  }>;
  backendId?: string;
  storeId?: string;
  storeName?: string;
  storeSlug?: string;
  isOfficialStore?: boolean;
  stock?: number;
  soldCount?: number;
  totalStock?: number;
}

const hasSizeVariants = (product: HomeSectionProduct) =>
  Array.isArray(product.variants)
  && product.variants.some((variant) => String(variant.size || '').trim().length > 0);

const buildSizeList = (variants: Array<{ size: string }>) =>
  Array.from(new Set(variants.map((variant) => String(variant.size || '').trim()).filter(Boolean)));

const enrichProductVariantsForHome = async (
  featured: HomeSectionProduct[],
  trending: HomeSectionProduct[],
  topSelling: HomeSectionProduct[],
) => {
  const uniqueProducts = new Map<string, HomeSectionProduct>();
  [...featured, ...trending, ...topSelling].forEach((product) => {
    uniqueProducts.set(String(product.id), product);
  });

  const enrichedById = new Map<string, HomeSectionProduct>();
  const rows = Array.from(uniqueProducts.values());
  await Promise.all(rows.map(async (product) => {
    const productId = String(product.id);
    if (hasSizeVariants(product)) {
      enrichedById.set(productId, product);
      return;
    }

    const candidates = [product.backendId, product.sku, productId]
      .map((value) => String(value || '').trim())
      .filter(Boolean);

    for (const identifier of candidates) {
      const detail = await productService.getByIdentifier(identifier);
      if (!detail?.variants || detail.variants.length === 0) {
        continue;
      }

      const normalizedVariants = detail.variants
        .map((variant) => ({
          color: String(variant.color || '').trim(),
          size: String(variant.size || '').trim(),
          backendId: variant.backendId,
        }))
        .filter((variant) => Boolean(variant.size));

      if (normalizedVariants.length === 0) {
        continue;
      }

      enrichedById.set(productId, {
        ...product,
        sizes: buildSizeList(normalizedVariants),
        variants: normalizedVariants,
      });
      return;
    }

    enrichedById.set(productId, product);
  }));

  const pick = (rowsToMap: HomeSectionProduct[]) =>
    rowsToMap.map((product) => enrichedById.get(String(product.id)) || product);

  return {
    featured: pick(featured),
    trending: pick(trending),
    topSelling: pick(topSelling),
  };
};

const Home = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [featuredStores, setFeaturedStores] = useState<MarketplaceStoreCard[]>([]);
  const [allStores, setAllStores] = useState<MarketplaceStoreCard[]>([]);
  const [categoryTabs, setCategoryTabs] = useState<MarketplaceHomeCategoryTab[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<HomeSectionProduct[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<HomeSectionProduct[]>([]);
  const [topSellingProducts, setTopSellingProducts] = useState<HomeSectionProduct[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadHomeData = async () => {
      try {
        const [data, storesResponse, topSellingResponse] = await Promise.all([
          marketplaceService.getHomeData(),
          marketplaceService.searchStores('', 0, 100).catch(() => null),
          marketplaceService.searchProducts('', 0, 10).catch(() => null),
        ]);
        if (!mounted) return;

        let storesFromApi = storesResponse?.items || [];
        if (storesResponse && storesResponse.totalPages > 1) {
          const pageRequests: Array<Promise<Awaited<ReturnType<typeof marketplaceService.searchStores>> | null>> = [];
          for (let page = 1; page < storesResponse.totalPages; page += 1) {
            pageRequests.push(
              marketplaceService.searchStores('', page, storesResponse.size || 100).catch(() => null),
            );
          }

          const extraPages = await Promise.all(pageRequests);
          storesFromApi = storesFromApi.concat(
            extraPages.flatMap((pageResult) => pageResult?.items || []),
          );
        }

        const dedupedStores = Array.from(
          new Map(storesFromApi.map((store) => [store.id, store])).values(),
        );
        if (!mounted) return;

        const featuredRows = data.featuredProducts;
        const trendingRows = data.trendingProducts;
        const topSellingRows = (
          topSellingResponse?.items && topSellingResponse.items.length > 0
            ? topSellingResponse.items
            : [...data.featuredProducts, ...data.trendingProducts]
        ).slice(0, 10);

        const enriched = await enrichProductVariantsForHome(featuredRows, trendingRows, topSellingRows);
        if (!mounted) return;

        setFeaturedStores(data.featuredStores);
        setAllStores(dedupedStores.length > 0 ? dedupedStores : data.featuredStores || []);
        setCategoryTabs(data.categoryTabs || []);
        setFeaturedProducts(enriched.featured);
        setTrendingProducts(enriched.trending);
        setTopSellingProducts(enriched.topSelling);
      } catch {
        if (!mounted) return;
        setFeaturedStores([]);
        setAllStores([]);
        setCategoryTabs([]);
        setFeaturedProducts([]);
        setTrendingProducts([]);
        setTopSellingProducts([]);
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

    return discountedProducts.slice(0, 12);
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
          badge: product.badge,
          colors: product.colors,
          sizes: product.sizes,
          variants: product.variants,
          storeName: product.storeName || 'Nh\u00e0 b\u00e1n',
          storeId: product.storeId,
          storeSlug: product.storeSlug,
          isOfficialStore: product.isOfficialStore,
          soldCount,
          totalStock,
        };
      }),
    [flashSaleProducts],
  );

  const topVendors = useMemo(() => {
    const source = allStores.length > 0 ? allStores : featuredStores;
    return [...source]
      .sort((a, b) => {
        const orderDiff = (b.totalOrders || 0) - (a.totalOrders || 0);
        if (orderDiff !== 0) return orderDiff;
        const ratingDiff = (b.rating || 0) - (a.rating || 0);
        if (ratingDiff !== 0) return ratingDiff;
        return a.name.localeCompare(b.name, 'vi');
      })
      .slice(0, 4);
  }, [allStores, featuredStores]);

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
            {/* Skeleton for Featured Products */}
            <div className="product-section-skeleton">
              <Skeleton type="text" width={240} height={28} />
              <div className="product-grid-skeleton">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="product-card-skeleton">
                    <Skeleton type="rectangular" height={280} />
                    <Skeleton type="text" width="80%" />
                    <Skeleton type="text" width="40%" />
                  </div>
                ))}
              </div>
            </div>

            {/* Skeleton for Suggested Products */}
            <div className="product-section-skeleton">
              <Skeleton type="text" width={240} height={28} />
              <div className="product-grid-skeleton">
                {[1, 2, 3, 4].map((i) => (
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
            <HeroSlider className="home-hero-wrap container" />
            <Categories
              categoryTabs={categoryTabs}
              featuredStores={featuredStores}
              showFeaturedStores={false}
            />

            <FlashSaleSection
              className="home-section-gap"
              items={flashSaleItems}
            />

            <section className="top-vendor-section container home-section-gap">
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
                        <span className="top-vendor-code">{store.slug || store.storeCode}</span>
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

            <section className="home-section-gap">
              <ProductSection
                title={'Sản phẩm mua nhiều'}
                products={topSellingProducts}
                viewAllLink="/search?scope=products"
                showQuickView={false}
                useSlider={false}
                maxItems={10}
                className="top-selling-section"
              />
            </section>
          </>
        )}
      </main>
    </div>
  );
};

export default Home;


