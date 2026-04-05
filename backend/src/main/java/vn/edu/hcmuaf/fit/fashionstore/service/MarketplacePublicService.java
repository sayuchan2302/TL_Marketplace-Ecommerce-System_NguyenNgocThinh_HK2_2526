package vn.edu.hcmuaf.fit.fashionstore.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.MarketplaceHomeResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.MarketplaceProductCardResponse;
import vn.edu.hcmuaf.fit.fashionstore.dto.response.MarketplaceStoreCardResponse;
import vn.edu.hcmuaf.fit.fashionstore.entity.Category;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductImage;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductVariant;
import vn.edu.hcmuaf.fit.fashionstore.entity.Store;
import vn.edu.hcmuaf.fit.fashionstore.repository.CategoryRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.ProductRepository;
import vn.edu.hcmuaf.fit.fashionstore.repository.StoreRepository;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MarketplacePublicService {

    private static final int HOME_STORE_LIMIT = 4;
    private static final int HOME_PRODUCT_LIMIT = 8;
    private static final String DEFAULT_PRODUCT_IMAGE =
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=672&h=990&fit=crop&fm=webp&q=80&auto=format";

    private final ProductRepository productRepository;
    private final StoreRepository storeRepository;
    private final CategoryRepository categoryRepository;

    public MarketplacePublicService(
            ProductRepository productRepository,
            StoreRepository storeRepository,
            CategoryRepository categoryRepository
    ) {
        this.productRepository = productRepository;
        this.storeRepository = storeRepository;
        this.categoryRepository = categoryRepository;
    }

    @Transactional(readOnly = true)
    public MarketplaceHomeResponse getMarketplaceHome() {
        List<Store> featuredStores = storeRepository.findTopPublicStores(PageRequest.of(0, HOME_STORE_LIMIT));

        List<Product> featuredPool = productRepository.findPublicFeaturedMarketplaceProducts(
                PageRequest.of(0, 40, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();
        List<Product> newestPool = productRepository.findPublicMarketplaceProducts(
                PageRequest.of(0, 60, Sort.by(Sort.Direction.DESC, "createdAt"))
        ).getContent();
        List<Product> trendingPool = productRepository.findPublicMarketplaceProducts(
                PageRequest.of(0, 60, Sort.by(
                        Sort.Order.desc("viewCount"),
                        Sort.Order.desc("updatedAt"),
                        Sort.Order.desc("createdAt")
                ))
        ).getContent();

        List<Product> featuredProducts = buildDistinctInStockProductList(
                List.of(featuredPool, newestPool),
                HOME_PRODUCT_LIMIT
        );
        List<Product> trendingProducts = buildDistinctInStockProductList(
                List.of(trendingPool, newestPool),
                HOME_PRODUCT_LIMIT
        );

        Map<UUID, Store> storesById = loadStoresByProductOwnership(featuredProducts, trendingProducts, featuredStores);

        return MarketplaceHomeResponse.builder()
                .featuredStores(featuredStores.stream()
                        .map(this::toStoreCardResponse)
                        .toList())
                .featuredProducts(featuredProducts.stream()
                        .map(product -> toProductCardResponse(product, storesById.get(product.getStoreId())))
                        .toList())
                .trendingProducts(trendingProducts.stream()
                        .map(product -> toProductCardResponse(product, storesById.get(product.getStoreId())))
                        .toList())
                .generatedAt(LocalDateTime.now())
                .build();
    }

    @Transactional(readOnly = true)
    public Page<MarketplaceProductCardResponse> searchProducts(String keyword, Pageable pageable) {
        return searchProducts(keyword, null, pageable);
    }

    @Transactional(readOnly = true)
    public Page<MarketplaceProductCardResponse> searchProducts(String keyword, String categorySlug, Pageable pageable) {
        Pageable resolved = resolveProductSearchPageable(pageable);
        String normalizedKeyword = normalizeKeyword(keyword);
        String normalizedCategorySlug = normalizeCategorySlug(categorySlug);

        Page<Product> productPage;
        if (!hasText(normalizedCategorySlug)) {
            productPage = productRepository.searchPublicMarketplaceProducts(normalizedKeyword, resolved);
        } else {
            List<UUID> scopedCategoryIds = resolveCategoryScopeIds(normalizedCategorySlug);
            if (scopedCategoryIds.isEmpty()) {
                return new PageImpl<>(List.of(), resolved, 0);
            }
            productPage = productRepository.searchPublicMarketplaceProductsByCategoryIds(
                    normalizedKeyword,
                    scopedCategoryIds,
                    resolved
            );
        }

        Map<UUID, Store> storesById = loadStoresByProductOwnership(productPage.getContent());

        List<MarketplaceProductCardResponse> rows = productPage.getContent().stream()
                .map(product -> toProductCardResponse(product, storesById.get(product.getStoreId())))
                .toList();

        return new PageImpl<>(rows, resolved, productPage.getTotalElements());
    }

    @Transactional(readOnly = true)
    public Page<MarketplaceStoreCardResponse> searchStores(String keyword, Pageable pageable) {
        Pageable resolved = resolveStoreSearchPageable(pageable);
        Page<Store> storePage = storeRepository.searchPublicStores(normalizeKeyword(keyword), resolved);

        List<MarketplaceStoreCardResponse> rows = storePage.getContent().stream()
                .map(this::toStoreCardResponse)
                .toList();

        return new PageImpl<>(rows, resolved, storePage.getTotalElements());
    }

    private Pageable resolveProductSearchPageable(Pageable pageable) {
        if (pageable == null) {
            return PageRequest.of(0, 20, Sort.by(Sort.Direction.DESC, "createdAt"));
        }

        if (pageable.getSort().isUnsorted()) {
            return PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "createdAt"));
        }

        return pageable;
    }

    private Pageable resolveStoreSearchPageable(Pageable pageable) {
        if (pageable == null) {
            return PageRequest.of(0, 20, Sort.by(
                    Sort.Order.desc("rating"),
                    Sort.Order.desc("totalOrders"),
                    Sort.Order.desc("createdAt")
            ));
        }

        if (pageable.getSort().isUnsorted()) {
            return PageRequest.of(
                    pageable.getPageNumber(),
                    pageable.getPageSize(),
                    Sort.by(
                            Sort.Order.desc("rating"),
                            Sort.Order.desc("totalOrders"),
                            Sort.Order.desc("createdAt")
                    )
            );
        }

        return pageable;
    }

    private String normalizeKeyword(String keyword) {
        if (keyword == null) {
            return null;
        }
        String normalized = keyword.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    private String normalizeCategorySlug(String categorySlug) {
        if (categorySlug == null) {
            return null;
        }
        String normalized = categorySlug.trim().toLowerCase(Locale.ROOT);
        return normalized.isEmpty() ? null : normalized;
    }

    private List<UUID> resolveCategoryScopeIds(String categorySlug) {
        Category root = categoryRepository.findBySlugIgnoreCase(categorySlug)
                .orElse(null);
        if (root == null || root.getId() == null) {
            return List.of();
        }

        Map<UUID, List<UUID>> childIdsByParentId = new HashMap<>();
        for (Category category : categoryRepository.findAll()) {
            if (category == null || category.getId() == null) {
                continue;
            }
            UUID parentId = category.getParent() != null ? category.getParent().getId() : null;
            if (parentId == null) {
                continue;
            }
            childIdsByParentId.computeIfAbsent(parentId, ignored -> new ArrayList<>())
                    .add(category.getId());
        }

        LinkedHashSet<UUID> scopeIds = new LinkedHashSet<>();
        Deque<UUID> stack = new ArrayDeque<>();
        stack.push(root.getId());

        while (!stack.isEmpty()) {
            UUID current = stack.pop();
            if (!scopeIds.add(current)) {
                continue;
            }
            for (UUID childId : childIdsByParentId.getOrDefault(current, List.of())) {
                if (childId != null) {
                    stack.push(childId);
                }
            }
        }

        return new ArrayList<>(scopeIds);
    }

    private List<Product> buildDistinctInStockProductList(List<List<Product>> pools, int limit) {
        LinkedHashMap<UUID, Product> byId = new LinkedHashMap<>();

        for (List<Product> pool : pools) {
            if (pool == null || pool.isEmpty()) {
                continue;
            }
            for (Product product : pool) {
                if (product == null || product.getId() == null || product.getStoreId() == null) {
                    continue;
                }
                if (!hasAvailableStock(product)) {
                    continue;
                }
                byId.putIfAbsent(product.getId(), product);
                if (byId.size() >= limit) {
                    break;
                }
            }
            if (byId.size() >= limit) {
                break;
            }
        }

        return new ArrayList<>(byId.values());
    }

    private Map<UUID, Store> loadStoresByProductOwnership(List<Product>... productGroups) {
        Set<UUID> storeIds = java.util.Arrays.stream(productGroups)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .map(Product::getStoreId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (storeIds.isEmpty()) {
            return Map.of();
        }

        return storeRepository.findAllById(storeIds).stream()
                .collect(Collectors.toMap(Store::getId, store -> store, (left, right) -> right, HashMap::new));
    }

    private Map<UUID, Store> loadStoresByProductOwnership(
            List<Product> featuredProducts,
            List<Product> trendingProducts,
            List<Store> featuredStores
    ) {
        Map<UUID, Store> storesById = new HashMap<>(loadStoresByProductOwnership(featuredProducts, trendingProducts));
        if (featuredStores == null || featuredStores.isEmpty()) {
            return storesById;
        }

        for (Store store : featuredStores) {
            if (store == null || store.getId() == null) {
                continue;
            }
            storesById.putIfAbsent(store.getId(), store);
        }
        return storesById;
    }

    private MarketplaceStoreCardResponse toStoreCardResponse(Store store) {
        return MarketplaceStoreCardResponse.builder()
                .id(store.getId())
                .storeCode(resolveStoreCode(store))
                .name(store.getName())
                .slug(store.getSlug())
                .logo(store.getLogo())
                .rating(defaultDouble(store.getRating()))
                .totalOrders(defaultInteger(store.getTotalOrders()))
                .liveProductCount(Math.toIntExact(productRepository.countActiveByStoreId(store.getId())))
                .build();
    }

    private MarketplaceProductCardResponse toProductCardResponse(Product product, Store store) {
        BigDecimal effectivePrice = resolveEffectivePrice(product);
        BigDecimal originalPrice = resolveOriginalPrice(product);

        return MarketplaceProductCardResponse.builder()
                .id(product.getId())
                .productCode(resolveProductCode(product))
                .name(product.getName())
                .image(resolvePrimaryImage(product))
                .price(effectivePrice)
                .priceAmount(formatMoneyAmount(effectivePrice))
                .originalPrice(originalPrice)
                .originalPriceAmount(formatMoneyAmount(originalPrice))
                .badge(Boolean.TRUE.equals(product.getIsFeatured()) ? "FEATURED" : null)
                .colors(resolveColors(product))
                .stock(resolveTotalStock(product))
                .storeId(store != null ? store.getId() : product.getStoreId())
                .storeName(store != null ? store.getName() : null)
                .storeSlug(store != null ? store.getSlug() : null)
                .storeLogo(store != null ? store.getLogo() : null)
                .storeRating(store != null ? defaultDouble(store.getRating()) : 0.0)
                .officialStore(store != null && isOfficialStore(store))
                .createdAt(product.getCreatedAt())
                .build();
    }

    private boolean hasAvailableStock(Product product) {
        return resolveTotalStock(product) > 0;
    }

    private int resolveTotalStock(Product product) {
        List<ProductVariant> variants = product.getVariants();
        if (variants == null || variants.isEmpty()) {
            return product.getStockQuantity() == null ? 0 : Math.max(0, product.getStockQuantity());
        }

        return variants.stream()
                .filter(variant -> !Boolean.FALSE.equals(variant.getIsActive()))
                .map(ProductVariant::getStockQuantity)
                .filter(Objects::nonNull)
                .mapToInt(Integer::intValue)
                .sum();
    }

    private List<String> resolveColors(Product product) {
        List<ProductVariant> variants = product.getVariants();
        if (variants == null || variants.isEmpty()) {
            return List.of();
        }

        return variants.stream()
                .filter(variant -> !Boolean.FALSE.equals(variant.getIsActive()))
                .map(ProductVariant::getColor)
                .filter(this::hasText)
                .distinct()
                .toList();
    }

    private String resolvePrimaryImage(Product product) {
        List<ProductImage> images = product.getImages();
        if (images == null || images.isEmpty()) {
            return DEFAULT_PRODUCT_IMAGE;
        }

        return images.stream()
                .filter(Objects::nonNull)
                .sorted(Comparator
                        .comparing((ProductImage image) -> !Boolean.TRUE.equals(image.getIsPrimary()))
                        .thenComparing(image -> image.getSortOrder() == null ? Integer.MAX_VALUE : image.getSortOrder()))
                .map(ProductImage::getUrl)
                .filter(this::hasText)
                .findFirst()
                .orElse(DEFAULT_PRODUCT_IMAGE);
    }

    private BigDecimal resolveEffectivePrice(Product product) {
        BigDecimal effective = product.getEffectivePrice();
        if (effective != null) {
            return effective;
        }
        if (product.getBasePrice() != null) {
            return product.getBasePrice();
        }
        return BigDecimal.ZERO;
    }

    private BigDecimal resolveOriginalPrice(Product product) {
        if (product.getSalePrice() != null
                && product.getBasePrice() != null
                && product.getBasePrice().compareTo(product.getSalePrice()) > 0) {
            return product.getBasePrice();
        }
        return null;
    }

    private String formatMoneyAmount(BigDecimal amount) {
        return amount == null ? null : amount.stripTrailingZeros().toPlainString();
    }

    private String resolveProductCode(Product product) {
        if (hasText(product.getSku())) {
            return product.getSku().trim();
        }
        return product.getId() == null ? "" : product.getId().toString();
    }

    private String resolveStoreCode(Store store) {
        if (store == null || store.getId() == null) {
            return "";
        }
        String raw = store.getId().toString().replace("-", "").toUpperCase(Locale.ROOT);
        return "SHOP-" + raw.substring(0, Math.min(8, raw.length()));
    }

    private boolean isOfficialStore(Store store) {
        return store.getCommissionRate() != null && store.getCommissionRate().compareTo(new BigDecimal("3.0")) <= 0;
    }

    private int defaultInteger(Integer value) {
        return value == null ? 0 : value;
    }

    private double defaultDouble(Double value) {
        return value == null ? 0.0 : value;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
