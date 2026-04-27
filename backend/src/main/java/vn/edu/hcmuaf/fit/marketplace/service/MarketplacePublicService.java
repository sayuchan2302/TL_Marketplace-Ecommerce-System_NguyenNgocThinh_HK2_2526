package vn.edu.hcmuaf.fit.marketplace.service;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmuaf.fit.marketplace.config.VisionSearchProperties;
import vn.edu.hcmuaf.fit.marketplace.dto.response.MarketplaceFlashSaleItemResponse;
import vn.edu.hcmuaf.fit.marketplace.dto.response.MarketplaceFlashSaleResponse;
import vn.edu.hcmuaf.fit.marketplace.dto.response.MarketplaceHomeResponse;
import vn.edu.hcmuaf.fit.marketplace.dto.response.MarketplaceImageSearchResponse;
import vn.edu.hcmuaf.fit.marketplace.dto.response.MarketplaceProductCardResponse;
import vn.edu.hcmuaf.fit.marketplace.dto.response.MarketplaceStoreCardResponse;
import vn.edu.hcmuaf.fit.marketplace.dto.response.VisionCatalogItemResponse;
import vn.edu.hcmuaf.fit.marketplace.dto.response.VisionCatalogPageResponse;
import vn.edu.hcmuaf.fit.marketplace.entity.Category;
import vn.edu.hcmuaf.fit.marketplace.entity.FlashSaleCampaign;
import vn.edu.hcmuaf.fit.marketplace.entity.FlashSaleItem;
import vn.edu.hcmuaf.fit.marketplace.entity.Product;
import vn.edu.hcmuaf.fit.marketplace.entity.ProductImage;
import vn.edu.hcmuaf.fit.marketplace.entity.ProductVariant;
import vn.edu.hcmuaf.fit.marketplace.entity.Store;
import vn.edu.hcmuaf.fit.marketplace.repository.CategoryRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.FlashSaleCampaignRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.FlashSaleItemRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ProductRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreRepository;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

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
    private final FlashSaleCampaignRepository flashSaleCampaignRepository;
    private final FlashSaleItemRepository flashSaleItemRepository;
    private final StorePerformanceMetricsService storePerformanceMetricsService;
    private final VisionSearchClient visionSearchClient;
    private final VisionSearchProperties visionSearchProperties;

    public MarketplacePublicService(
            ProductRepository productRepository,
            StoreRepository storeRepository,
            CategoryRepository categoryRepository,
            FlashSaleCampaignRepository flashSaleCampaignRepository,
            FlashSaleItemRepository flashSaleItemRepository,
            StorePerformanceMetricsService storePerformanceMetricsService,
            VisionSearchClient visionSearchClient,
            VisionSearchProperties visionSearchProperties
    ) {
        this.productRepository = productRepository;
        this.storeRepository = storeRepository;
        this.categoryRepository = categoryRepository;
        this.flashSaleCampaignRepository = flashSaleCampaignRepository;
        this.flashSaleItemRepository = flashSaleItemRepository;
        this.storePerformanceMetricsService = storePerformanceMetricsService;
        this.visionSearchClient = visionSearchClient;
        this.visionSearchProperties = visionSearchProperties;
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

    @Transactional(readOnly = true)
    public MarketplaceImageSearchResponse searchProductsByImage(MultipartFile file, int limit) {
        validateImageSearchFile(file);
        int resolvedLimit = Math.min(Math.max(limit, 1), Math.max(1, visionSearchProperties.getMaxCandidates()));

        VisionSearchClient.VisionSearchResult rawResult = visionSearchClient.searchImage(file, resolvedLimit);
        List<UUID> rankedIds = rawResult.candidates().stream()
                .map(VisionSearchClient.VisionCandidate::backendProductId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (rankedIds.isEmpty()) {
            return MarketplaceImageSearchResponse.builder()
                    .items(List.of())
                    .totalCandidates(0)
                    .mode("image")
                    .indexVersion(rawResult.indexVersion())
                    .build();
        }

        List<Product> products = productRepository.findPublicMarketplaceProductsByIds(rankedIds);
        Map<UUID, Product> productsById = products.stream()
                .filter(product -> product.getId() != null)
                .collect(Collectors.toMap(Product::getId, product -> product, (left, right) -> left, LinkedHashMap::new));
        Map<UUID, Store> storesById = loadStoresByProductOwnership(products);

        List<MarketplaceProductCardResponse> items = rankedIds.stream()
                .map(productsById::get)
                .filter(Objects::nonNull)
                .map(product -> toProductCardResponse(product, storesById.get(product.getStoreId())))
                .limit(resolvedLimit)
                .toList();

        return MarketplaceImageSearchResponse.builder()
                .items(items)
                .totalCandidates(rawResult.totalCandidates())
                .mode("image")
                .indexVersion(rawResult.indexVersion())
                .build();
    }

    @Transactional(readOnly = true)
    public VisionCatalogPageResponse exportVisionCatalog(Pageable pageable) {
        Pageable resolved = resolveVisionCatalogPageable(pageable);
        Page<Product> productPage = productRepository.findPublicMarketplaceProducts(resolved);
        Map<UUID, Store> storesById = loadStoresByProductOwnership(productPage.getContent());

        List<VisionCatalogItemResponse> rows = productPage.getContent().stream()
                .flatMap(product -> mapVisionCatalogRows(product, storesById.get(product.getStoreId())).stream())
                .toList();

        return VisionCatalogPageResponse.builder()
                .items(rows)
                .totalProducts(productPage.getTotalElements())
                .page(productPage.getNumber())
                .size(productPage.getSize())
                .totalPages(productPage.getTotalPages())
                .generatedAt(LocalDateTime.now())
                .build();
    }

    @Transactional(readOnly = true)
    public MarketplaceFlashSaleResponse getActiveFlashSale() {
        LocalDateTime now = LocalDateTime.now();
        FlashSaleCampaign campaign = flashSaleCampaignRepository.findFirstActiveAt(now).orElse(null);
        if (campaign == null || campaign.getId() == null) {
            return MarketplaceFlashSaleResponse.builder()
                    .serverTime(now)
                    .items(List.of())
                    .build();
        }

        List<FlashSaleItem> rawItems = flashSaleItemRepository.findPublicActiveByCampaignId(
                campaign.getId(),
                FlashSaleCampaign.CampaignStatus.RUNNING,
                FlashSaleItem.ItemStatus.ACTIVE,
                now
        );

        if (rawItems.isEmpty()) {
            return MarketplaceFlashSaleResponse.builder()
                    .campaignId(campaign.getId())
                    .campaignName(campaign.getName())
                    .startAt(campaign.getStartAt())
                    .endAt(campaign.getEndAt())
                    .serverTime(now)
                    .items(List.of())
                    .build();
        }

        Set<UUID> storeIds = rawItems.stream()
                .map(FlashSaleItem::getProduct)
                .filter(Objects::nonNull)
                .map(Product::getStoreId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<UUID, Store> storesById = storeIds.isEmpty()
                ? Map.of()
                : storeRepository.findAllById(storeIds).stream()
                .collect(Collectors.toMap(Store::getId, store -> store, (left, right) -> right, HashMap::new));

        List<MarketplaceFlashSaleItemResponse> items = rawItems.stream()
                .map(item -> toFlashSaleItemResponse(item, storesById.get(item.getProduct() != null ? item.getProduct().getStoreId() : null)))
                .filter(Objects::nonNull)
                .toList();

        return MarketplaceFlashSaleResponse.builder()
                .campaignId(campaign.getId())
                .campaignName(campaign.getName())
                .startAt(campaign.getStartAt())
                .endAt(campaign.getEndAt())
                .serverTime(now)
                .items(items)
                .build();
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

    private Pageable resolveVisionCatalogPageable(Pageable pageable) {
        if (pageable == null) {
            return PageRequest.of(0, 100, Sort.by(Sort.Direction.DESC, "updatedAt"));
        }
        if (pageable.getSort().isUnsorted()) {
            return PageRequest.of(
                    pageable.getPageNumber(),
                    pageable.getPageSize(),
                    Sort.by(Sort.Direction.DESC, "updatedAt")
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
        StorePerformanceMetricsService.StorePerformanceMetrics performanceMetrics =
                storePerformanceMetricsService.resolve(store.getId());
        return MarketplaceStoreCardResponse.builder()
                .id(store.getId())
                .storeCode(resolveStoreCode(store))
                .name(store.getName())
                .slug(store.getSlug())
                .logo(store.getLogo())
                .rating(defaultDouble(store.getRating()))
                .totalOrders(performanceMetrics.totalOrders())
                .liveProductCount(Math.toIntExact(productRepository.countActiveByStoreId(store.getId())))
                .build();
    }

    private MarketplaceProductCardResponse toProductCardResponse(Product product, Store store) {
        BigDecimal effectivePrice = resolveEffectivePrice(product);
        BigDecimal originalPrice = resolveOriginalPrice(product);

        return MarketplaceProductCardResponse.builder()
                .id(product.getId())
                .slug(product.getSlug())
                .productCode(resolveProductCode(product))
                .name(product.getName())
                .category(product.getCategory() != null ? product.getCategory().getName() : null)
                .categorySlug(product.getCategory() != null ? product.getCategory().getSlug() : null)
                .image(resolvePrimaryImage(product))
                .price(effectivePrice)
                .priceAmount(formatMoneyAmount(effectivePrice))
                .originalPrice(originalPrice)
                .originalPriceAmount(formatMoneyAmount(originalPrice))
                .badge(Boolean.TRUE.equals(product.getIsFeatured()) ? "FEATURED" : null)
                .material(product.getMaterial())
                .fit(product.getFit())
                .gender(product.getGender() != null ? product.getGender().name() : null)
                .colors(resolveColors(product))
                .stock(resolveTotalStock(product))
                .storeId(store != null ? store.getId() : product.getStoreId())
                .storeName(store != null ? store.getName() : null)
                .storeSlug(store != null ? store.getSlug() : null)
                .storeLogo(store != null ? store.getLogo() : null)
                .storeRating(store != null ? defaultDouble(store.getRating()) : 0.0)
                .officialStore(store != null && isOfficialStore(store))
                .sizes(resolveSizes(product))
                .variants(resolveVariants(product))
                .createdAt(product.getCreatedAt())
                .build();
    }

    private List<VisionCatalogItemResponse> mapVisionCatalogRows(Product product, Store store) {
        if (product == null || product.getId() == null || product.getStoreId() == null || store == null) {
            return List.of();
        }

        List<ProductImage> images = product.getImages();
        if (images == null || images.isEmpty()) {
            return List.of();
        }

        return images.stream()
                .filter(Objects::nonNull)
                .filter(image -> hasText(image.getUrl()))
                .sorted(Comparator
                        .comparing((ProductImage image) -> image.getSortOrder() == null ? Integer.MAX_VALUE : image.getSortOrder())
                        .thenComparing(image -> !Boolean.TRUE.equals(image.getIsPrimary())))
                .map(image -> VisionCatalogItemResponse.builder()
                        .backendProductId(product.getId())
                        .productSlug(product.getSlug())
                        .storeId(product.getStoreId())
                        .storeSlug(store.getSlug())
                        .categorySlug(product.getCategory() != null ? product.getCategory().getSlug() : null)
                        .imageUrl(image.getUrl().trim())
                        .imageIndex(image.getSortOrder() == null ? 0 : image.getSortOrder())
                        .isPrimary(Boolean.TRUE.equals(image.getIsPrimary()))
                        .build())
                .toList();
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

        LinkedHashMap<String, String> colorsBySwatchKey = new LinkedHashMap<>();
        for (ProductVariant variant : variants) {
            if (Boolean.FALSE.equals(variant.getIsActive())) {
                continue;
            }
            String color = variant.getColor();
            if (!hasText(color)) {
                continue;
            }
            String normalizedColor = color.trim();
            String colorHex = hasText(variant.getColorHex())
                    ? variant.getColorHex().trim().toLowerCase(Locale.ROOT)
                    : "";
            String swatchKey = !colorHex.isBlank()
                    ? "hex:" + colorHex
                    : "name:" + normalizedColor.toLowerCase(Locale.ROOT);
            colorsBySwatchKey.putIfAbsent(swatchKey, normalizedColor);
        }

        return List.copyOf(colorsBySwatchKey.values());
    }

    private List<String> resolveSizes(Product product) {
        List<ProductVariant> variants = product.getVariants();
        if (variants == null || variants.isEmpty()) {
            return List.of();
        }

        return variants.stream()
                .filter(variant -> !Boolean.FALSE.equals(variant.getIsActive()))
                .map(ProductVariant::getSize)
                .filter(this::hasText)
                .map(String::trim)
                .distinct()
                .toList();
    }

    private List<MarketplaceProductCardResponse.VariantOption> resolveVariants(Product product) {
        List<ProductVariant> variants = product.getVariants();
        if (variants == null || variants.isEmpty()) {
            return List.of();
        }

        return variants.stream()
                .filter(variant -> !Boolean.FALSE.equals(variant.getIsActive()))
                .filter(variant -> hasText(variant.getSize()))
                .map(variant -> MarketplaceProductCardResponse.VariantOption.builder()
                        .id(variant.getId())
                        .sku(variant.getSku())
                        .color(hasText(variant.getColor()) ? variant.getColor().trim() : "")
                        .colorHex(hasText(variant.getColorHex()) ? variant.getColorHex().trim().toLowerCase(Locale.ROOT) : null)
                        .size(variant.getSize().trim())
                        .stockQuantity(variant.getStockQuantity() == null ? 0 : Math.max(0, variant.getStockQuantity()))
                        .build())
                .toList();
    }

    private MarketplaceFlashSaleItemResponse toFlashSaleItemResponse(FlashSaleItem item, Store store) {
        if (item == null || item.getProduct() == null || item.getProduct().getId() == null) {
            return null;
        }
        Product product = item.getProduct();
        ProductVariant variant = item.getVariant();

        if (!hasPublicAvailability(product, variant)) {
            return null;
        }
        if (store == null || !isPublicStore(store)) {
            return null;
        }

        int quota = Math.max(0, defaultInteger(item.getQuota()));
        int soldCount = Math.max(0, defaultInteger(item.getSoldCount()));
        if (quota <= 0 || soldCount >= quota) {
            return null;
        }

        BigDecimal originalPrice = resolveUnitPriceForFlash(product, variant);
        BigDecimal flashPrice = item.getFlashPrice() == null ? BigDecimal.ZERO : item.getFlashPrice();
        if (flashPrice.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }

        return MarketplaceFlashSaleItemResponse.builder()
                .flashSaleItemId(item.getId())
                .productId(product.getId())
                .productSlug(product.getSlug())
                .productCode(resolveProductCode(product))
                .variantId(variant != null ? variant.getId() : null)
                .name(product.getName())
                .image(resolvePrimaryImage(product))
                .flashPrice(flashPrice)
                .flashPriceAmount(formatMoneyAmount(flashPrice))
                .originalPrice(originalPrice)
                .originalPriceAmount(formatMoneyAmount(originalPrice))
                .soldCount(soldCount)
                .quota(quota)
                .storeId(store != null ? store.getId() : product.getStoreId())
                .storeName(store != null ? store.getName() : null)
                .storeSlug(store != null ? store.getSlug() : null)
                .officialStore(store != null && isOfficialStore(store))
                .colors(resolveColors(product))
                .sizes(resolveSizes(product))
                .variants(resolveVariants(product))
                .build();
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

    private BigDecimal resolveUnitPriceForFlash(Product product, ProductVariant variant) {
        BigDecimal unitPrice = variant != null ? variant.getPrice() : resolveEffectivePrice(product);
        return unitPrice == null ? BigDecimal.ZERO : unitPrice;
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
        return false;
    }

    private boolean hasPublicAvailability(Product product, ProductVariant variant) {
        if (product.getStoreId() == null) {
            return false;
        }
        if (product.getStatus() != Product.ProductStatus.ACTIVE) {
            return false;
        }
        if (product.getApprovalStatus() != null && product.getApprovalStatus() != Product.ApprovalStatus.APPROVED) {
            return false;
        }

        if (variant != null) {
            return !Boolean.FALSE.equals(variant.getIsActive()) && defaultInteger(variant.getStockQuantity()) > 0;
        }
        return resolveTotalStock(product) > 0;
    }

    private boolean isPublicStore(Store store) {
        if (store == null) {
            return false;
        }
        return store.getApprovalStatus() == Store.ApprovalStatus.APPROVED
                && store.getStatus() == Store.StoreStatus.ACTIVE;
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

    private void validateImageSearchFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Image file is required");
        }
        if (file.getSize() > Math.max(1L, visionSearchProperties.getMaxUploadSizeBytes())) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE, "Image file is too large");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Uploaded file must be an image");
        }
    }
}
