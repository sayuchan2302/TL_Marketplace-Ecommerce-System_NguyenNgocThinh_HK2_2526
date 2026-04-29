package vn.edu.hcmuaf.fit.marketplace.seeder;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmuaf.fit.marketplace.config.GapSeedProperties;
import vn.edu.hcmuaf.fit.marketplace.dto.request.ProductRequest;
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
import vn.edu.hcmuaf.fit.marketplace.repository.ProductVariantRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreRepository;
import vn.edu.hcmuaf.fit.marketplace.service.ProductService;

import java.io.BufferedReader;
import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
public class GapProductImportRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(GapProductImportRunner.class);
    private static final Set<String> ALLOWED_MASTER_CATEGORIES = Set.of("apparel", "accessories");
    private static final Set<String> ALLOWED_ROOTS = Set.of("men", "women", "accessories");
    private static final int MAX_IMAGES_PER_PRODUCT = 6;
    private static final int MAX_COLORS_PER_PRODUCT = 4;
    private static final int MAX_SIZES_PER_PRODUCT = 6;
    private static final String DEFAULT_IMAGE =
            "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=672&h=990&fit=crop&fm=webp&q=80&auto=format";
    private static final List<ImportCategoryDefinition> IMPORT_CATEGORY_DEFINITIONS = List.of(
            new ImportCategoryDefinition("Nam", "men", "Danh mục gốc cho thời trang nam.", null, 1),
            new ImportCategoryDefinition("Nữ", "women", "Danh mục gốc cho thời trang nữ.", null, 2),
            new ImportCategoryDefinition("Phụ kiện", "accessories", "Danh mục gốc cho phụ kiện.", null, 3),

            new ImportCategoryDefinition("Áo nam", "men-ao", "Nhóm áo dành cho nam.", "men", 10),
            new ImportCategoryDefinition("Quần nam", "men-quan", "Nhóm quần dành cho nam.", "men", 20),
            new ImportCategoryDefinition("Đồ thể thao nam", "men-do-the-thao", "Nhóm đồ thể thao nam.", "men", 30),
            new ImportCategoryDefinition("Đồ mặc nhà nam", "men-do-mac-nha", "Nhóm đồ mặc nhà nam.", "men", 40),

            new ImportCategoryDefinition("Áo nữ", "women-ao", "Nhóm áo dành cho nữ.", "women", 10),
            new ImportCategoryDefinition("Váy đầm nữ", "women-vay-dam", "Nhóm váy đầm dành cho nữ.", "women", 20),
            new ImportCategoryDefinition("Quần nữ", "women-quan", "Nhóm quần dành cho nữ.", "women", 30),
            new ImportCategoryDefinition("Đồ thể thao nữ", "women-do-the-thao", "Nhóm đồ thể thao nữ.", "women", 40),
            new ImportCategoryDefinition("Đồ mặc nhà nữ", "women-do-mac-nha", "Nhóm đồ mặc nhà nữ.", "women", 50),

            new ImportCategoryDefinition("Túi và ví", "accessories-tui-va-vi", "Nhóm túi và ví.", "accessories", 10),
            new ImportCategoryDefinition("Phụ kiện thời trang", "accessories-phu-kien-thoi-trang", "Nhóm phụ kiện thời trang.", "accessories", 20),
            new ImportCategoryDefinition("Phụ kiện khác", "accessories-phu-kien-khac", "Nhóm phụ kiện khác.", "accessories", 30),

            new ImportCategoryDefinition("Áo thun nam", "men-ao-thun", "Áo thun nam.", "men-ao", 1),
            new ImportCategoryDefinition("Áo polo nam", "men-ao-polo", "Áo polo nam.", "men-ao", 2),
            new ImportCategoryDefinition("Áo sơ mi nam", "men-ao-so-mi", "Áo sơ mi nam.", "men-ao", 3),
            new ImportCategoryDefinition("Áo hoodie nam", "men-ao-hoodie", "Áo hoodie nam.", "men-ao", 4),
            new ImportCategoryDefinition("Áo len nam", "men-ao-len", "Áo len nam.", "men-ao", 5),

            new ImportCategoryDefinition("Quần jeans nam", "men-quan-jeans", "Quần jeans nam.", "men-quan", 1),
            new ImportCategoryDefinition("Quần tây nam", "men-quan-tay", "Quần tây nam.", "men-quan", 2),
            new ImportCategoryDefinition("Quần kaki nam", "men-quan-kaki", "Quần kaki nam.", "men-quan", 3),
            new ImportCategoryDefinition("Quần short nam", "men-quan-short", "Quần short nam.", "men-quan", 4),
            new ImportCategoryDefinition("Quần jogger nam", "men-quan-jogger", "Quần jogger nam.", "men-quan", 5),

            new ImportCategoryDefinition("Áo thể thao nam", "men-ao-the-thao", "Áo thể thao nam.", "men-do-the-thao", 1),
            new ImportCategoryDefinition("Quần thể thao nam", "men-quan-the-thao", "Quần thể thao nam.", "men-do-the-thao", 2),
            new ImportCategoryDefinition("Set thể thao nam", "men-set-the-thao", "Set thể thao nam.", "men-do-the-thao", 3),

            new ImportCategoryDefinition("Áo mặc nhà nam", "men-ao-mac-nha", "Áo mặc nhà nam.", "men-do-mac-nha", 1),
            new ImportCategoryDefinition("Quần mặc nhà nam", "men-quan-mac-nha", "Quần mặc nhà nam.", "men-do-mac-nha", 2),
            new ImportCategoryDefinition("Bộ mặc nhà nam", "men-bo-mac-nha", "Bộ mặc nhà nam.", "men-do-mac-nha", 3),

            new ImportCategoryDefinition("Áo thun nữ", "women-ao-thun", "Áo thun nữ.", "women-ao", 1),
            new ImportCategoryDefinition("Áo kiểu nữ", "women-ao-kieu", "Áo kiểu nữ.", "women-ao", 2),
            new ImportCategoryDefinition("Áo sơ mi nữ", "women-ao-so-mi", "Áo sơ mi nữ.", "women-ao", 3),
            new ImportCategoryDefinition("Áo croptop nữ", "women-ao-croptop", "Áo croptop nữ.", "women-ao", 4),
            new ImportCategoryDefinition("Áo khoác nữ", "women-ao-khoac", "Áo khoác nữ.", "women-ao", 5),

            new ImportCategoryDefinition("Váy liền nữ", "women-vay-lien", "Váy liền nữ.", "women-vay-dam", 1),
            new ImportCategoryDefinition("Váy dự tiệc nữ", "women-vay-du-tiec", "Váy dự tiệc nữ.", "women-vay-dam", 2),
            new ImportCategoryDefinition("Váy công sở nữ", "women-vay-cong-so", "Váy công sở nữ.", "women-vay-dam", 3),
            new ImportCategoryDefinition("Váy maxi nữ", "women-vay-maxi", "Váy maxi nữ.", "women-vay-dam", 4),

            new ImportCategoryDefinition("Quần jeans nữ", "women-quan-jeans", "Quần jeans nữ.", "women-quan", 1),
            new ImportCategoryDefinition("Quần short nữ", "women-quan-short", "Quần short nữ.", "women-quan", 2),
            new ImportCategoryDefinition("Quần tây nữ", "women-quan-tay", "Quần tây nữ.", "women-quan", 3),
            new ImportCategoryDefinition("Quần legging nữ", "women-quan-legging", "Quần legging nữ.", "women-quan", 4),

            new ImportCategoryDefinition("Áo thể thao nữ", "women-ao-the-thao", "Áo thể thao nữ.", "women-do-the-thao", 1),
            new ImportCategoryDefinition("Quần thể thao nữ", "women-quan-the-thao", "Quần thể thao nữ.", "women-do-the-thao", 2),
            new ImportCategoryDefinition("Set thể thao nữ", "women-set-the-thao", "Set thể thao nữ.", "women-do-the-thao", 3),

            new ImportCategoryDefinition("Áo mặc nhà nữ", "women-ao-mac-nha", "Áo mặc nhà nữ.", "women-do-mac-nha", 1),
            new ImportCategoryDefinition("Quần mặc nhà nữ", "women-quan-mac-nha", "Quần mặc nhà nữ.", "women-do-mac-nha", 2),
            new ImportCategoryDefinition("Bộ mặc nhà nữ", "women-bo-mac-nha", "Bộ mặc nhà nữ.", "women-do-mac-nha", 3),

            new ImportCategoryDefinition("Túi xách", "tui-xach", "Túi xách.", "accessories-tui-va-vi", 1),
            new ImportCategoryDefinition("Túi đeo chéo", "tui-deo-cheo", "Túi đeo chéo.", "accessories-tui-va-vi", 2),
            new ImportCategoryDefinition("Balo", "balo", "Balo.", "accessories-tui-va-vi", 3),
            new ImportCategoryDefinition("Ví", "vi", "Ví.", "accessories-tui-va-vi", 4),

            new ImportCategoryDefinition("Nón mũ", "non-mu", "Nón mũ.", "accessories-phu-kien-thoi-trang", 1),
            new ImportCategoryDefinition("Thắt lưng", "that-lung", "Thắt lưng.", "accessories-phu-kien-thoi-trang", 2),
            new ImportCategoryDefinition("Khăn", "khan", "Khăn.", "accessories-phu-kien-thoi-trang", 3),
            new ImportCategoryDefinition("Tất", "tat", "Tất.", "accessories-phu-kien-thoi-trang", 4),

            new ImportCategoryDefinition("Kính mắt", "kinh-mat", "Kính mắt.", "accessories-phu-kien-khac", 1),
            new ImportCategoryDefinition("Đồng hồ", "dong-ho", "Đồng hồ.", "accessories-phu-kien-khac", 2),
            new ImportCategoryDefinition("Trang sức", "trang-suc", "Trang sức.", "accessories-phu-kien-khac", 3)
    );
    private static final AtomicBoolean EXECUTED = new AtomicBoolean(false);

    private final GapSeedProperties properties;
    private final ProductService productService;
    private final ProductRepository productRepository;
    private final ProductVariantRepository productVariantRepository;
    private final StoreRepository storeRepository;
    private final CategoryRepository categoryRepository;
    private final FlashSaleCampaignRepository flashSaleCampaignRepository;
    private final FlashSaleItemRepository flashSaleItemRepository;
    private final GapCategoryMapper categoryMapper;
    private final GapCoverageReporter coverageReporter;

    @Autowired
    public GapProductImportRunner(
            GapSeedProperties properties,
            ProductService productService,
            ProductRepository productRepository,
            ProductVariantRepository productVariantRepository,
            StoreRepository storeRepository,
            CategoryRepository categoryRepository,
            FlashSaleCampaignRepository flashSaleCampaignRepository,
            FlashSaleItemRepository flashSaleItemRepository
    ) {
        this(
                properties,
                productService,
                productRepository,
                productVariantRepository,
                storeRepository,
                categoryRepository,
                flashSaleCampaignRepository,
                flashSaleItemRepository,
                new GapCategoryMapper(),
                new GapCoverageReporter()
        );
    }

    GapProductImportRunner(
            GapSeedProperties properties,
            ProductService productService,
            ProductRepository productRepository,
            ProductVariantRepository productVariantRepository,
            StoreRepository storeRepository,
            CategoryRepository categoryRepository,
            FlashSaleCampaignRepository flashSaleCampaignRepository,
            FlashSaleItemRepository flashSaleItemRepository,
            GapCategoryMapper categoryMapper,
            GapCoverageReporter coverageReporter
    ) {
        this.properties = properties;
        this.productService = productService;
        this.productRepository = productRepository;
        this.productVariantRepository = productVariantRepository;
        this.storeRepository = storeRepository;
        this.categoryRepository = categoryRepository;
        this.flashSaleCampaignRepository = flashSaleCampaignRepository;
        this.flashSaleItemRepository = flashSaleItemRepository;
        this.categoryMapper = categoryMapper;
        this.coverageReporter = coverageReporter;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!EXECUTED.compareAndSet(false, true)) {
            return;
        }
        if (properties.isReportEnabled() && !properties.isEnabled()) {
            runBaselineCoverageReport();
            return;
        }
        if (!properties.isEnabled()) {
            return;
        }
        runImport();
    }

    @Transactional
    void runImport() {
        int targetCount = Math.max(0, properties.getTargetCount());
        if (targetCount == 0) {
            log.info("GAP import skipped because target-count is 0.");
            return;
        }

        List<Store> approvedActiveStores = new ArrayList<>(storeRepository.findByApprovalStatusAndStatus(
                Store.ApprovalStatus.APPROVED,
                Store.StoreStatus.ACTIVE
        ));
        approvedActiveStores.sort(Comparator.comparing(store -> store.getId().toString()));
        if (approvedActiveStores.isEmpty()) {
            log.warn("GAP import skipped because no APPROVED+ACTIVE stores were found.");
            return;
        }

        List<LeafCategory> leafCategories = loadLeafCategories();
        if (leafCategories.isEmpty()) {
            log.warn("GAP import skipped because no leaf categories under men/women/accessories were found.");
            return;
        }

        Path stylesPath;
        Path imagesPath;
        try {
            stylesPath = resolveInputPath(properties.getStylesPath());
            imagesPath = resolveInputPath(properties.getImagesPath());
        } catch (IllegalStateException ex) {
            log.error("GAP import skipped: {}", ex.getMessage());
            return;
        }

        Map<Long, List<String>> imageLinks;
        List<StyleRow> styleRows;
        try {
            imageLinks = loadImageLinks(imagesPath);
            styleRows = loadStyleRows(stylesPath);
        } catch (IOException ex) {
            log.error("GAP import failed while reading CSV files.", ex);
            return;
        }

        List<Product> importedProductsBefore = List.copyOf(findExistingImportedProducts());
        List<Product> existingBatch = importedProductsBefore;
        List<StyleAnalysis> sourceAnalyses = analyzeSourceRows(leafCategories, imageLinks, styleRows);
        List<Product> publicImportedProductsBefore = List.copyOf(findPublicImportedProducts());
        GapCoverageReporter.CoverageSnapshot beforeSnapshot = null;
        if (properties.isReportEnabled()) {
            beforeSnapshot = captureCoverageSnapshot(
                    "before",
                    leafCategories,
                    sourceAnalyses,
                    importedProductsBefore,
                    publicImportedProductsBefore
            );
            writeBeforeCoverageReport(beforeSnapshot);
        }

        if (properties.isCleanBeforeImport() && !existingBatch.isEmpty()) {
            removeExistingImportedProducts(existingBatch);
            existingBatch = List.of();
        }

        Set<String> existingSlugs = existingBatch.stream()
                .map(Product::getSlug)
                .filter(slug -> slug != null && !slug.isBlank())
                .map(slug -> slug.trim().toLowerCase(Locale.ROOT))
                .collect(Collectors.toSet());

        int skippedMissingImages = 0;
        List<StyleAnalysis> candidates = new ArrayList<>();
        for (StyleAnalysis analysis : sourceAnalyses) {
            if (existingSlugs.contains(analysis.productSlug())) {
                continue;
            }
            if (!analysis.hasImages()) {
                skippedMissingImages++;
                continue;
            }
            if (!analysis.isImportable()) {
                continue;
            }
            candidates.add(analysis);
        }

        if (candidates.isEmpty()) {
            log.warn("GAP import skipped because no eligible candidates were found.");
            if (properties.isReportEnabled() && beforeSnapshot != null) {
                writeAfterCoverageReport(beforeSnapshot, leafCategories, sourceAnalyses);
            }
            ensureDefaultFlashSaleCampaign();
            return;
        }

        List<StyleAnalysis> selected = selectCandidatesForImport(candidates, targetCount);
        if (selected.isEmpty()) {
            log.warn("GAP import skipped because allocation returned no candidates.");
            if (properties.isReportEnabled() && beforeSnapshot != null) {
                writeAfterCoverageReport(beforeSnapshot, leafCategories, sourceAnalyses);
            }
            ensureDefaultFlashSaleCampaign();
            return;
        }

        int imported = 0;
        int skipped = 0;
        Map<UUID, Integer> countsByCategory = new HashMap<>();

        for (int index = 0; index < selected.size(); index++) {
            StyleAnalysis analysis = selected.get(index);
            Store store = approvedActiveStores.get(index % approvedActiveStores.size());
            ProductRequest request = buildProductRequest(analysis);
            try {
                Product created = productService.createForStore(request, store.getId());
                applyGalleryImages(created, analysis.imageUrls());
                if (isFeaturedCandidate(analysis.row().styleId())) {
                    created.setIsFeatured(true);
                }
                productRepository.save(created);
                imported++;
                countsByCategory.merge(analysis.preferredLeaf().id(), 1, Integer::sum);
            } catch (RuntimeException ex) {
                skipped++;
                log.warn(
                        "Skip GAP style {} due to import error: {}",
                        analysis.row().styleId(),
                        ex.getMessage()
                );
            }
        }

        log.info(
                "GAP import completed: imported={}, skipped={}, skippedMissingImages={}, target={}, stores={}, leafCategories={}",
                imported,
                skipped,
                skippedMissingImages,
                targetCount,
                approvedActiveStores.size(),
                leafCategories.size()
        );
        log.info("GAP import category coverage: {} leaf categories received products.", countsByCategory.size());
        if (properties.isReportEnabled() && beforeSnapshot != null) {
            writeAfterCoverageReport(beforeSnapshot, leafCategories, sourceAnalyses);
        }
        ensureDefaultFlashSaleCampaign();
    }

    private void runBaselineCoverageReport() {
        List<LeafCategory> leafCategories = loadReportLeafCategories();
        if (leafCategories.isEmpty()) {
            log.warn("GAP coverage report skipped because no leaf categories under men/women/accessories were found.");
            return;
        }

        Path stylesPath;
        Path imagesPath;
        try {
            stylesPath = resolveInputPath(properties.getStylesPath());
            imagesPath = resolveInputPath(properties.getImagesPath());
        } catch (IllegalStateException ex) {
            log.error("GAP coverage report skipped: {}", ex.getMessage());
            return;
        }

        Map<Long, List<String>> imageLinks;
        List<StyleRow> styleRows;
        try {
            imageLinks = loadImageLinks(imagesPath);
            styleRows = loadStyleRows(stylesPath);
        } catch (IOException ex) {
            log.error("GAP coverage report failed while reading CSV files.", ex);
            return;
        }

        List<Product> importedProducts = List.copyOf(findExistingImportedProducts());
        List<Product> publicImportedProducts = List.copyOf(findPublicImportedProducts());
        List<StyleAnalysis> sourceAnalyses = analyzeSourceRows(leafCategories, imageLinks, styleRows);
        GapCoverageReporter.CoverageSnapshot snapshot = captureCoverageSnapshot(
                "before",
                leafCategories,
                sourceAnalyses,
                importedProducts,
                publicImportedProducts
        );
        if (snapshot != null) {
            writeBeforeCoverageReport(snapshot);
        }
    }

    private void ensureDefaultFlashSaleCampaign() {
        long campaignCount = flashSaleCampaignRepository.count();
        long itemCount = flashSaleItemRepository.count();
        if (campaignCount > 0 && itemCount > 0) {
            return;
        }

        if (campaignCount > 0 && itemCount == 0) {
            flashSaleCampaignRepository.deleteAll();
        }

        List<Product> publicProducts = productRepository.findAllPublicProducts();
        if (publicProducts.isEmpty()) {
            log.warn("Skip Flash Sale seed because no public products are available.");
            return;
        }

        LocalDateTime now = LocalDateTime.now();
        FlashSaleCampaign campaign = FlashSaleCampaign.builder()
                .name("Flash Sale gio vang")
                .description("Campaign mac dinh cho moi truong local seed.")
                .scope(FlashSaleCampaign.CampaignScope.PLATFORM)
                .status(FlashSaleCampaign.CampaignStatus.RUNNING)
                .startAt(now.minusHours(1))
                .endAt(now.plusDays(3))
                .updatedBy("gap-seed")
                .build();
        campaign = flashSaleCampaignRepository.save(campaign);

        int createdItems = 0;
        int sortOrder = 0;
        for (Product product : publicProducts) {
            if (createdItems >= 24) {
                break;
            }
            if (product == null || product.getId() == null) {
                continue;
            }

            ProductVariant variant = productVariantRepository.findByProductIdAndIsActiveTrue(product.getId()).stream()
                    .filter(v -> v.getStockQuantity() != null && v.getStockQuantity() > 0)
                    .findFirst()
                    .orElse(null);

            int stock = variant != null
                    ? Math.max(variant.getStockQuantity() != null ? variant.getStockQuantity() : 0, 0)
                    : Math.max(product.getStockQuantity() != null ? product.getStockQuantity() : 0, 0);
            if (stock <= 0) {
                continue;
            }

            BigDecimal basePrice = product.getEffectivePrice();
            if (basePrice == null || basePrice.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }
            if (variant != null && variant.getPriceAdjustment() != null) {
                basePrice = basePrice.add(variant.getPriceAdjustment());
            }
            if (basePrice.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            BigDecimal flashPrice = basePrice.multiply(new BigDecimal("0.80")).setScale(0, RoundingMode.HALF_UP);
            if (flashPrice.compareTo(BigDecimal.ZERO) <= 0) {
                continue;
            }

            FlashSaleItem item = FlashSaleItem.builder()
                    .campaign(campaign)
                    .product(product)
                    .variant(variant)
                    .flashPrice(flashPrice)
                    .quota(Math.max(20, Math.min(120, stock)))
                    .soldCount(0)
                    .status(FlashSaleItem.ItemStatus.ACTIVE)
                    .sortOrder(sortOrder++)
                    .build();
            flashSaleItemRepository.save(item);
            createdItems++;
        }

        if (createdItems == 0) {
            flashSaleCampaignRepository.delete(campaign);
            log.warn("Rollback Flash Sale seed because no eligible items were created.");
            return;
        }

        log.info("Seeded default Flash Sale campaign with {} items for local environment.", createdItems);
    }

    private List<LeafCategory> loadLeafCategories() {
        ensureImportCategoryTree();
        List<Category> categories = categoryRepository.findAll();
        if (categories.isEmpty()) {
            return List.of();
        }

        Map<UUID, String> slugById = new HashMap<>();
        Map<UUID, UUID> parentById = new HashMap<>();
        Set<UUID> parentIds = new HashSet<>();

        for (Category category : categories) {
            if (category.getId() == null) {
                continue;
            }
            UUID id = category.getId();
            slugById.put(id, normalizedToken(category.getSlug()));
            UUID parentId = category.getParent() != null ? category.getParent().getId() : null;
            parentById.put(id, parentId);
            if (parentId != null) {
                parentIds.add(parentId);
            }
        }

        List<LeafCategory> leaves = new ArrayList<>();
        for (Category category : categories) {
            UUID id = category.getId();
            if (id == null || parentIds.contains(id)) {
                continue;
            }
            if (!Boolean.TRUE.equals(category.getIsVisible())) {
                continue;
            }
            String slug = normalizedToken(category.getSlug());
            if (slug.isBlank()) {
                continue;
            }
            String rootSlug = resolveRootSlug(id, slugById, parentById);
            if (!ALLOWED_ROOTS.contains(rootSlug)) {
                continue;
            }
            UUID parentId = parentById.get(id);
            leaves.add(new LeafCategory(id, slug, parentId, rootSlug));
        }

        leaves.sort(Comparator.comparing(LeafCategory::slug));
        return leaves;
    }

    private List<LeafCategory> loadReportLeafCategories() {
        Map<String, ImportCategoryDefinition> definitionsBySlug = IMPORT_CATEGORY_DEFINITIONS.stream()
                .collect(Collectors.toMap(
                        definition -> normalizedToken(definition.slug()),
                        Function.identity(),
                        (left, right) -> left,
                        LinkedHashMap::new
                ));
        Set<String> parentSlugs = IMPORT_CATEGORY_DEFINITIONS.stream()
                .map(ImportCategoryDefinition::parentSlug)
                .filter(parentSlug -> parentSlug != null && !parentSlug.isBlank())
                .map(this::normalizedToken)
                .collect(Collectors.toCollection(LinkedHashSet::new));

        List<LeafCategory> leaves = new ArrayList<>();
        for (ImportCategoryDefinition definition : IMPORT_CATEGORY_DEFINITIONS) {
            String slug = normalizedToken(definition.slug());
            if (parentSlugs.contains(slug)) {
                continue;
            }
            String rootSlug = resolveDefinitionRootSlug(slug, definitionsBySlug);
            if (!ALLOWED_ROOTS.contains(rootSlug)) {
                continue;
            }
            String parentSlug = definition.parentSlug() == null ? "" : normalizedToken(definition.parentSlug());
            leaves.add(new LeafCategory(null, slug, null, rootSlug));
        }
        leaves.sort(Comparator.comparing(LeafCategory::slug));
        return leaves;
    }

    private void ensureImportCategoryTree() {
        List<Category> categories = new ArrayList<>(categoryRepository.findAll());
        Map<String, Category> categoryBySlug = categories.stream()
                .filter(category -> category.getSlug() != null && !category.getSlug().isBlank())
                .collect(Collectors.toMap(
                        category -> normalizedToken(category.getSlug()),
                        category -> category,
                        (left, right) -> left,
                        LinkedHashMap::new
                ));

        int created = 0;
        List<ImportCategoryDefinition> pending = new ArrayList<>();
        for (ImportCategoryDefinition definition : IMPORT_CATEGORY_DEFINITIONS) {
            if (!categoryBySlug.containsKey(normalizedToken(definition.slug()))) {
                pending.add(definition);
            }
        }

        boolean createdInPass;
        do {
            createdInPass = false;
            List<ImportCategoryDefinition> remaining = new ArrayList<>();
            for (ImportCategoryDefinition definition : pending) {
                Category parent = null;
                if (definition.parentSlug() != null) {
                    parent = categoryBySlug.get(normalizedToken(definition.parentSlug()));
                    if (parent == null) {
                        remaining.add(definition);
                        continue;
                    }
                }

                Category category = new Category();
                category.setName(definition.name());
                category.setSlug(definition.slug());
                category.setDescription(definition.description());
                category.setParent(parent);
                category.setSortOrder(definition.sortOrder());
                category.setIsVisible(true);
                category.setShowOnMenu(false);

                Category saved = categoryRepository.save(category);
                categoryBySlug.put(normalizedToken(definition.slug()), saved);
                categories.add(saved);
                created++;
                createdInPass = true;
            }
            pending = remaining;
        } while (createdInPass && !pending.isEmpty());

        if (!pending.isEmpty()) {
            String unresolved = pending.stream()
                    .map(definition -> definition.slug() + "->" + definition.parentSlug())
                    .limit(8)
                    .collect(Collectors.joining(", "));
            log.warn(
                    "Skipped auto-creating {} GAP import categories because parent chain is incomplete: {}",
                    pending.size(),
                    unresolved
            );
        }

        if (created > 0) {
            log.info("Created {} missing categories required for GAP import.", created);
        }
    }

    private String resolveDefinitionRootSlug(
            String slug,
            Map<String, ImportCategoryDefinition> definitionsBySlug
    ) {
        String current = slug;
        Set<String> visited = new LinkedHashSet<>();
        while (current != null && !current.isBlank() && visited.add(current)) {
            ImportCategoryDefinition definition = definitionsBySlug.get(current);
            if (definition == null || definition.parentSlug() == null || definition.parentSlug().isBlank()) {
                return current == null ? "" : current;
            }
            current = normalizedToken(definition.parentSlug());
        }
        return "";
    }

    private String resolveRootSlug(UUID categoryId, Map<UUID, String> slugById, Map<UUID, UUID> parentById) {
        UUID current = categoryId;
        Set<UUID> visited = new HashSet<>();
        while (current != null && visited.add(current)) {
            UUID parentId = parentById.get(current);
            if (parentId == null) {
                String slug = slugById.get(current);
                return slug == null ? "" : slug;
            }
            current = parentId;
        }
        return "";
    }

    private List<StyleAnalysis> analyzeSourceRows(
            List<LeafCategory> leafCategories,
            Map<Long, List<String>> imageLinks,
            List<StyleRow> styleRows
    ) {
        Map<String, LeafCategory> leafBySlug = leafCategories.stream()
                .collect(Collectors.toMap(LeafCategory::slug, Function.identity()));

        List<StyleAnalysis> analyses = new ArrayList<>(styleRows.size());
        for (StyleRow row : styleRows) {
            if (!ALLOWED_MASTER_CATEGORIES.contains(normalizedToken(row.masterCategory()))) {
                continue;
            }
            GapCategoryMapper.MappingResult mapping = categoryMapper.map(row);
            LeafCategory preferredLeaf = mapping.isImportable()
                    ? leafBySlug.get(normalizedToken(mapping.chosenLeafSlug()))
                    : null;
            analyses.add(new StyleAnalysis(
                    row,
                    slugForStyle(row.styleId()),
                    mapping,
                    preferredLeaf,
                    resolveCandidateImageUrls(imageLinks.get(row.styleId()))
            ));
        }
        return analyses;
    }

    private List<StyleAnalysis> selectCandidatesForImport(List<StyleAnalysis> candidates, int targetCount) {
        return candidates.stream()
                .sorted(Comparator.comparingLong(analysis -> analysis.row().styleId()))
                .limit(Math.max(0, targetCount))
                .toList();
    }

    private GapCoverageReporter.CoverageSnapshot captureCoverageSnapshot(
            String label,
            List<LeafCategory> leafCategories,
            List<StyleAnalysis> sourceAnalyses,
            List<Product> importedProducts,
            List<Product> publicImportedProducts
    ) {
        return coverageReporter.captureSnapshot(
                label,
                leafCategories,
                sourceAnalyses,
                importedProducts,
                publicImportedProducts
        );
    }

    private void writeBeforeCoverageReport(GapCoverageReporter.CoverageSnapshot snapshot) {
        try {
            coverageReporter.writeBeforeReport(resolveReportOutputDir(), snapshot);
            log.info("Wrote GAP baseline coverage report to {}", resolveReportOutputDir());
        } catch (IOException ex) {
            log.error("Failed to write GAP baseline coverage report.", ex);
        }
    }

    private void writeAfterCoverageReport(
            GapCoverageReporter.CoverageSnapshot beforeSnapshot,
            List<LeafCategory> leafCategories,
            List<StyleAnalysis> sourceAnalyses
    ) {
        try {
            GapCoverageReporter.CoverageSnapshot afterSnapshot = captureCoverageSnapshot(
                    "after",
                    leafCategories,
                    sourceAnalyses,
                    findExistingImportedProducts(),
                    findPublicImportedProducts()
            );
            coverageReporter.writeAfterReport(resolveReportOutputDir(), beforeSnapshot, afterSnapshot);
            log.info("Wrote GAP post-import coverage report to {}", resolveReportOutputDir());
        } catch (IOException ex) {
            log.error("Failed to write GAP post-import coverage report.", ex);
        }
    }

    private ProductRequest buildProductRequest(StyleAnalysis analysis) {
        StyleRow row = analysis.row();
        LeafCategory leaf = analysis.preferredLeaf();
        PricePlan pricePlan = planPrice(leaf.slug(), row.styleId());

        String usage = normalizedUsage(row.usage());
        String season = normalizedSeason(row.season());
        String color = normalizedColor(row.baseColour());
        String articleType = fallbackText(row.articleType(), "Fashion item");
        String productName = fallbackText(row.productDisplayName(), articleType + " " + row.styleId());
        String normalizedName = normalizeText(productName);
        if (normalizedName.isBlank()) {
            normalizedName = "GAP Item " + row.styleId();
        }

        List<ProductRequest.VariantRequest> variants = buildVariants(
                leaf,
                row.styleId(),
                color,
                row.colorOptions(),
                row.colorHexOptions(),
                row.sizeOptions()
        );

        return ProductRequest.builder()
                .name(normalizedName)
                .slug(slugForStyle(row.styleId()))
                .description(buildDescription(row, usage, season))
                .sizeAndFit(buildSizeAndFit(row, articleType, usage))
                .fabricAndCare(buildFabricAndCare(row))
                .categoryId(leaf.id())
                .basePrice(pricePlan.basePrice())
                .salePrice(pricePlan.salePrice())
                .fit(selectFit(row))
                .gender(resolveGender(row.gender()))
                .status(Product.ProductStatus.ACTIVE.name())
                .imageUrl(fallbackText(analysis.imageUrls().stream().findFirst().orElse(""), DEFAULT_IMAGE))
                .variants(variants)
                .build();
    }

    private List<ProductRequest.VariantRequest> buildVariants(
            LeafCategory leaf,
            long styleId,
            String color,
            List<String> crawledColors,
            Map<String, String> crawledColorHexes,
            List<String> crawledSizes
    ) {
        int baseStock = 12 + (int) Math.floorMod(styleId, 48);
        List<VariantColor> colors = resolveVariantColors(crawledColors, crawledColorHexes, color);
        List<String> sizes = resolveVariantSizes(crawledSizes, leaf.rootSlug());

        List<ProductRequest.VariantRequest> variants = new ArrayList<>(colors.size() * sizes.size());
        int variantIndex = 0;
        for (VariantColor variantColor : colors) {
            for (String size : sizes) {
                int stock = Math.max(1, baseStock - (variantIndex % 6) * 2);
                variants.add(ProductRequest.VariantRequest.builder()
                        .color(variantColor.name())
                        .colorHex(variantColor.hex())
                        .size(size)
                        .stockQuantity(stock)
                        .priceAdjustment(BigDecimal.ZERO)
                        .isActive(true)
                        .build());
                variantIndex++;
            }
        }
        return variants;
    }

    private List<VariantColor> resolveVariantColors(
            List<String> crawledColors,
            Map<String, String> crawledColorHexes,
            String fallbackColor
    ) {
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        Map<String, String> safeColorHexes = crawledColorHexes == null ? Map.of() : crawledColorHexes;
        for (String candidate : crawledColors == null ? List.<String>of() : crawledColors) {
            String normalized = normalizedColor(candidate);
            if (!normalized.isBlank()) {
                unique.putIfAbsent(normalized, normalizeColorHex(safeColorHexes.get(normalized)));
            }
            if (unique.size() >= MAX_COLORS_PER_PRODUCT) {
                break;
            }
        }

        if (unique.isEmpty()) {
            String fallback = normalizedColor(fallbackColor);
            unique.put(fallback, normalizeColorHex(safeColorHexes.get(fallback)));
        }

        List<VariantColor> deduplicated = new ArrayList<>();
        Set<String> usedHex = new LinkedHashSet<>();
        for (Map.Entry<String, String> entry : unique.entrySet()) {
            String name = entry.getKey();
            String hex = entry.getValue();
            if (name == null || name.isBlank()) {
                continue;
            }
            if (hex != null && !hex.isBlank() && !usedHex.add(hex)) {
                continue;
            }
            deduplicated.add(new VariantColor(name, hex));
            if (deduplicated.size() >= MAX_COLORS_PER_PRODUCT) {
                break;
            }
        }

        if (deduplicated.isEmpty()) {
            String fallback = normalizedColor(fallbackColor);
            deduplicated.add(new VariantColor(fallback, normalizeColorHex(safeColorHexes.get(fallback))));
        }
        return List.copyOf(deduplicated);
    }

    private List<String> resolveVariantSizes(List<String> crawledSizes, String rootSlug) {
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String raw : crawledSizes == null ? List.<String>of() : crawledSizes) {
            String normalized = normalizeVariantSize(raw);
            if (normalized.isBlank()) {
                continue;
            }
            unique.add(normalized);
            if (unique.size() >= MAX_SIZES_PER_PRODUCT) {
                break;
            }
        }

        if (!unique.isEmpty()) {
            return List.copyOf(unique);
        }

        if ("accessories".equals(rootSlug)) {
            return List.of("Free");
        }
        if ("women".equals(rootSlug)) {
            return List.of("S", "M");
        }
        return List.of("M", "L");
    }

    private String normalizeVariantSize(String raw) {
        String normalized = normalizeText(raw).toUpperCase(Locale.ROOT);
        if (normalized.isBlank()) {
            return "";
        }
        String compact = normalized.replaceAll("\\s+", " ").trim();
        if (compact.equals("ONESIZE") || compact.equals("ONE SIZE")) {
            return "Free";
        }
        if (compact.equals("F")) {
            return "Free";
        }
        return compact;
    }

    private PricePlan planPrice(String leafSlug, long styleId) {
        int minK;
        int maxK;

        if (leafSlug.contains("dong-ho")) {
            minK = 399;
            maxK = 1999;
        } else if (leafSlug.contains("trang-suc")) {
            minK = 159;
            maxK = 1099;
        } else if (leafSlug.contains("ao-khoac") || leafSlug.contains("vay")) {
            minK = 299;
            maxK = 1299;
        } else if (leafSlug.contains("quan")) {
            minK = 249;
            maxK = 899;
        } else if (leafSlug.contains("accessories")
                || leafSlug.contains("tui")
                || leafSlug.contains("vi")
                || leafSlug.contains("that-lung")
                || leafSlug.contains("khan")
                || leafSlug.contains("tat")
                || leafSlug.contains("kinh")
                || leafSlug.contains("non")
                || leafSlug.contains("balo")) {
            minK = 129;
            maxK = 799;
        } else {
            minK = 199;
            maxK = 799;
        }

        long spread = (long) maxK - minK + 1L;
        long baseK = minK + Math.floorMod(styleId, spread);
        BigDecimal basePrice = BigDecimal.valueOf(baseK * 1_000L);

        BigDecimal salePrice = null;
        if (Math.floorMod(styleId, 10) < 7) {
            int discountPct = 5 + (int) Math.floorMod(styleId, 16);
            long sale = (basePrice.longValue() * (100L - discountPct)) / 100L;
            sale = (sale / 1_000L) * 1_000L;
            if (sale > 0 && sale < basePrice.longValue()) {
                salePrice = BigDecimal.valueOf(sale);
            }
        }
        return new PricePlan(basePrice, salePrice);
    }

    private String buildDescription(StyleRow row, String usage, String season) {
        List<String> gapDetails = parseSectionList(row.productDetails());
        if (!gapDetails.isEmpty()) {
            return String.join("\n", gapDetails);
        }

        String article = fallbackText(row.articleType(), "Fashion");
        String subCategory = fallbackText(row.subCategory(), "General");
        String master = fallbackText(row.masterCategory(), "Apparel");
        return "Imported from GAP dataset. "
                + "Master category: " + master + ". "
                + "Sub-category: " + subCategory + ". "
                + "Article type: " + article + ". "
                + "Usage: " + usage + ". "
                + "Season: " + season + ".";
    }

    private String buildSizeAndFit(StyleRow row, String articleType, String usage) {
        List<String> sizeFitLines = parseSectionList(row.sizeFitDetails());
        if (!sizeFitLines.isEmpty()) {
            return String.join("\n", sizeFitLines);
        }
        return "GAP import\nArticle type: " + articleType + "\nUsage: " + usage;
    }

    private String buildCareInstructions(StyleRow row) {
        List<String> careLines = parseSectionList(row.careDetails());
        if (!careLines.isEmpty()) {
            return String.join("\n", careLines);
        }
        return "Machine wash cold. Do not bleach. Imported dataset product.";
    }

    private String buildMaterial(StyleRow row) {
        List<String> materialLines = parseSectionList(row.fabricDetails());
        if (!materialLines.isEmpty()) {
            return String.join(" - ", materialLines);
        }
        return selectMaterial(row.styleId());
    }

    private String buildFabricAndCare(StyleRow row) {
        String material = buildMaterial(row);
        String care = buildCareInstructions(row);
        if (material.isBlank() && care.isBlank()) {
            return "";
        }
        if (material.isBlank()) {
            return care;
        }
        if (care.isBlank()) {
            return material;
        }
        return material + "\n" + care;
    }

    private String selectMaterial(long styleId) {
        String[] options = {"Cotton", "Polyester Blend", "Linen Blend", "Denim", "Knitted"};
        return options[(int) Math.floorMod(styleId, options.length)];
    }

    private String selectFit(StyleRow row) {
        String sizeFit = normalizedToken(row.sizeFitDetails());
        if (sizeFit.contains("slim")) return "Slim";
        if (sizeFit.contains("relaxed")) return "Relaxed";
        if (sizeFit.contains("regular")) return "Regular";
        if (sizeFit.contains("classic")) return "Regular";
        if (sizeFit.contains("loose")) return "Relaxed";
        if (sizeFit.contains("straight")) return "Regular";
        return selectFitByStyleId(row.styleId());
    }

    private String selectFitByStyleId(long styleId) {
        String[] options = {"Regular", "Slim", "Relaxed", "Comfort"};
        return options[(int) Math.floorMod(styleId, options.length)];
    }

    private String resolveGender(String rawGender) {
        String gender = normalizedToken(rawGender);
        if (gender.equals("women") || gender.equals("girls")) {
            return Product.Gender.FEMALE.name();
        }
        if (gender.equals("men") || gender.equals("boys")) {
            return Product.Gender.MALE.name();
        }
        return Product.Gender.UNISEX.name();
    }

    private boolean isFeaturedCandidate(long styleId) {
        return Math.floorMod(styleId, 10) == 0;
    }

    private String slugForStyle(long styleId) {
        return ("gap-" + styleId).toLowerCase(Locale.ROOT);
    }

    private Map<Long, List<String>> loadImageLinks(Path path) throws IOException {
        List<Map<String, String>> rows = readCsv(path);
        Map<Long, LinkedHashSet<String>> groupedLinks = new HashMap<>(rows.size());
        for (Map<String, String> row : rows) {
            long id = parseId(fallbackText(row.get("id"), row.get("filename")));
            if (id <= 0) {
                continue;
            }
            String link = normalizeText(row.get("link"));
            if (!link.isBlank()) {
                LinkedHashSet<String> links = groupedLinks.computeIfAbsent(id, ignored -> new LinkedHashSet<>());
                if (links.size() < MAX_IMAGES_PER_PRODUCT) {
                    links.add(link);
                }
            }
        }
        Map<Long, List<String>> result = new HashMap<>(groupedLinks.size());
        for (Map.Entry<Long, LinkedHashSet<String>> entry : groupedLinks.entrySet()) {
            result.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return result;
    }

    private List<StyleRow> loadStyleRows(Path path) throws IOException {
        List<Map<String, String>> rows = readCsv(path);
        List<StyleRow> styles = new ArrayList<>(rows.size());
        for (Map<String, String> row : rows) {
            long id = parseId(row.get("id"));
            if (id <= 0) {
                continue;
            }
            styles.add(new StyleRow(
                    id,
                    normalizeText(row.get("gender")),
                    normalizeText(row.get("masterCategory")),
                    normalizeText(row.get("subCategory")),
                    normalizeText(row.get("articleType")),
                    normalizeText(row.get("baseColour")),
                    parseOptionList(fallbackText(row.get("colorOptions"), row.get("colors"))),
                    parseColorHexMap(fallbackText(row.get("colorHexOptions"), row.get("colorHexes"))),
                    parseOptionList(fallbackText(row.get("sizeOptions"), row.get("sizes"))),
                    normalizeText(row.get("season")),
                    normalizeText(row.get("year")),
                    normalizeText(row.get("usage")),
                    normalizeText(row.get("productDisplayName")),
                    normalizeText(fallbackText(row.get("productDetails"), row.get("detailsText"))),
                    normalizeText(row.get("sizeFitDetails")),
                    normalizeText(row.get("fabricDetails")),
                    normalizeText(row.get("careDetails"))
            ));
        }
        return styles;
    }

    private List<Map<String, String>> readCsv(Path path) throws IOException {
        try (BufferedReader reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
            String headerLine = reader.readLine();
            if (headerLine == null) {
                return List.of();
            }

            List<String> headers = parseCsvLine(headerLine);
            if (!headers.isEmpty()) {
                headers.set(0, stripBom(headers.get(0)));
            }
            List<Map<String, String>> rows = new ArrayList<>();

            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                List<String> columns = parseCsvLine(line);
                Map<String, String> row = new HashMap<>();
                for (int idx = 0; idx < headers.size(); idx++) {
                    String header = headers.get(idx);
                    String value = idx < columns.size() ? columns.get(idx) : "";
                    row.put(header, value);
                }
                rows.add(row);
            }
            return rows;
        }
    }

    private List<String> parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;

        for (int idx = 0; idx < line.length(); idx++) {
            char ch = line.charAt(idx);
            if (ch == '"') {
                if (inQuotes && idx + 1 < line.length() && line.charAt(idx + 1) == '"') {
                    current.append('"');
                    idx++;
                } else {
                    inQuotes = !inQuotes;
                }
                continue;
            }
            if (ch == ',' && !inQuotes) {
                values.add(current.toString());
                current.setLength(0);
                continue;
            }
            current.append(ch);
        }
        values.add(current.toString());
        return values;
    }

    private String stripBom(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        if (value.charAt(0) == '\uFEFF') {
            return value.substring(1);
        }
        return value;
    }

    private Path resolveInputPath(String configuredPath) {
        String raw = normalizeText(configuredPath);
        if (raw.isBlank()) {
            throw new IllegalStateException("CSV path is blank. Please configure app.seed.gap paths.");
        }

        Path direct = Path.of(raw);
        List<Path> candidates = new ArrayList<>();
        if (direct.isAbsolute()) {
            candidates.add(direct);
        } else {
            Path cwd = Path.of("").toAbsolutePath().normalize();
            candidates.add(cwd.resolve(direct).normalize());
            candidates.add(cwd.resolve("..").resolve(direct).normalize());
            candidates.add(direct.toAbsolutePath().normalize());
        }

        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return candidate;
            }
        }

        throw new IllegalStateException("CSV file not found: " + raw);
    }

    private long parseId(String raw) {
        String token = normalizeText(raw);
        if (token.isBlank()) {
            return -1L;
        }
        StringBuilder digits = new StringBuilder();
        for (int i = 0; i < token.length(); i++) {
            char ch = token.charAt(i);
            if (Character.isDigit(ch)) {
                digits.append(ch);
            }
        }
        if (digits.isEmpty()) {
            return -1L;
        }
        try {
            return Long.parseLong(digits.toString());
        } catch (NumberFormatException ex) {
            return -1L;
        }
    }

    private String normalizedColor(String color) {
        String normalized = normalizeText(color);
        if (normalized.isBlank() || normalized.equalsIgnoreCase("NA")) {
            return "Mixed";
        }
        return normalized;
    }

    private String normalizedUsage(String usage) {
        String normalized = normalizeText(usage);
        if (normalized.isBlank() || normalized.equalsIgnoreCase("NA")) {
            return "Casual";
        }
        return normalized;
    }

    private String normalizedSeason(String season) {
        String normalized = normalizeText(season);
        if (normalized.isBlank() || normalized.equalsIgnoreCase("NA")) {
            return "All season";
        }
        return normalized;
    }

    private String normalizedToken(String value) {
        return normalizeText(value).toLowerCase(Locale.ROOT);
    }

    private String normalizeText(String value) {
        if (value == null) {
            return "";
        }
        return Normalizer.normalize(value, Normalizer.Form.NFC).trim();
    }

    private String fallbackText(String value, String fallback) {
        String normalized = normalizeText(value);
        return normalized.isBlank() ? fallback : normalized;
    }

    private List<String> parseOptionList(String raw) {
        String normalized = normalizeText(raw);
        if (normalized.isBlank()) {
            return List.of();
        }
        LinkedHashSet<String> values = new LinkedHashSet<>();
        String[] parts = normalized.split("[|;,]");
        for (String part : parts) {
            String token = normalizeText(part);
            if (!token.isBlank()) {
                values.add(token);
            }
        }
        if (values.isEmpty()) {
            return List.of();
        }
        return List.copyOf(values);
    }

    private List<String> parseSectionList(String raw) {
        String normalized = normalizeText(raw);
        if (normalized.isBlank()) {
            return List.of();
        }

        LinkedHashSet<String> values = new LinkedHashSet<>();
        String[] parts = normalized.split("\\|");
        for (String part : parts) {
            String token = normalizeText(part);
            if (!token.isBlank()) {
                values.add(token);
            }
        }

        if (values.isEmpty()) {
            return List.of();
        }
        return List.copyOf(values);
    }

    private Map<String, String> parseColorHexMap(String raw) {
        String normalized = normalizeText(raw);
        if (normalized.isBlank()) {
            return Map.of();
        }

        LinkedHashMap<String, String> map = new LinkedHashMap<>();
        String[] entries = normalized.split("[|;,]");
        for (String entry : entries) {
            String token = normalizeText(entry);
            if (token.isBlank()) {
                continue;
            }

            int separator = token.indexOf('=');
            if (separator < 0) {
                separator = token.indexOf(':');
            }
            if (separator <= 0) {
                continue;
            }

            String colorName = normalizedColor(token.substring(0, separator));
            String colorHex = normalizeColorHex(token.substring(separator + 1));
            if (colorName.isBlank() || colorHex == null) {
                continue;
            }
            map.putIfAbsent(colorName, colorHex);
        }

        if (map.isEmpty()) {
            return Map.of();
        }
        return Map.copyOf(map);
    }

    private String normalizeColorHex(String rawColorHex) {
        String normalized = normalizeText(rawColorHex);
        if (normalized.isBlank()) {
            return null;
        }
        if (!normalized.startsWith("#")) {
            normalized = "#" + normalized;
        }
        if (!normalized.matches("^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")) {
            return null;
        }
        if (normalized.length() == 4) {
            char r = normalized.charAt(1);
            char g = normalized.charAt(2);
            char b = normalized.charAt(3);
            normalized = "#" + r + r + g + g + b + b;
        }
        return normalized.toLowerCase(Locale.ROOT);
    }

    private List<String> resolveCandidateImageUrls(List<String> links) {
        if (links == null || links.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> normalizedLinks = new LinkedHashSet<>();
        for (String link : links) {
            String normalized = normalizeText(link);
            if (!normalized.isBlank()) {
                normalizedLinks.add(normalized);
            }
            if (normalizedLinks.size() >= MAX_IMAGES_PER_PRODUCT) {
                break;
            }
        }
        if (normalizedLinks.isEmpty()) {
            return List.of();
        }
        return List.copyOf(normalizedLinks);
    }

    private List<Product> findExistingImportedProducts() {
        return productRepository.findBySlugStartingWithIgnoreCase("gap-");
    }

    private List<Product> findPublicImportedProducts() {
        return productRepository.findAllPublicProducts().stream()
                .filter(product -> product.getSlug() != null)
                .filter(product -> product.getSlug().trim().toLowerCase(Locale.ROOT).startsWith("gap-"))
                .toList();
    }

    private Path resolveReportOutputDir() {
        String configured = normalizeText(properties.getReportOutputDir());
        if (configured.isBlank()) {
            configured = "backend/target/gap-coverage";
        }

        Path direct = Path.of(configured);
        if (direct.isAbsolute()) {
            return direct.normalize();
        }

        Path cwd = Path.of("").toAbsolutePath().normalize();
        List<Path> candidates = List.of(
                cwd.resolve(direct).normalize(),
                cwd.resolve("..").resolve(direct).normalize(),
                direct.toAbsolutePath().normalize()
        );

        for (Path candidate : candidates) {
            if (Files.exists(candidate)) {
                return candidate;
            }
            Path parent = candidate.getParent();
            if (parent != null && Files.exists(parent)) {
                return candidate;
            }
        }

        return candidates.get(0);
    }

    private void removeExistingImportedProducts(List<Product> existingBatch) {
        List<UUID> productIds = existingBatch.stream()
                .map(Product::getId)
                .filter(id -> id != null)
                .toList();

        if (!productIds.isEmpty()) {
            List<ProductVariant> variants = productVariantRepository.findByProductIdIn(productIds);
            List<UUID> variantIds = (variants == null ? List.<ProductVariant>of() : variants).stream()
                    .map(ProductVariant::getId)
                    .filter(id -> id != null)
                    .toList();

            int flashSaleItemsDeleted = flashSaleItemRepository.deleteByProductIds(productIds);
            if (!variantIds.isEmpty()) {
                flashSaleItemsDeleted += flashSaleItemRepository.deleteByVariantIds(variantIds);
            }
            if (flashSaleItemsDeleted > 0) {
                flashSaleItemRepository.flush();
                log.info(
                        "Removed {} flash sale items linked to existing GAP-imported products before cleanup.",
                        flashSaleItemsDeleted
                );
            }
        }

        productRepository.deleteAll(existingBatch);
        productRepository.flush();
        log.info("Removed {} existing GAP-imported products with slug prefix gap-.", existingBatch.size());
    }

    private void applyGalleryImages(Product product, List<String> imageUrls) {
        List<String> normalized = resolveCandidateImageUrls(imageUrls);
        List<ProductImage> images = new ArrayList<>(normalized.size());
        for (int i = 0; i < normalized.size(); i++) {
            images.add(ProductImage.builder()
                    .product(product)
                    .url(normalized.get(i))
                    .alt(product.getName())
                    .sortOrder(i)
                    .isPrimary(i == 0)
                    .build());
        }
        product.setImages(images);
    }

    static record LeafCategory(UUID id, String slug, UUID parentId, String rootSlug) {}

    static record StyleRow(
            long styleId,
            String gender,
            String masterCategory,
            String subCategory,
            String articleType,
            String baseColour,
            List<String> colorOptions,
            Map<String, String> colorHexOptions,
            List<String> sizeOptions,
            String season,
            String year,
            String usage,
            String productDisplayName,
            String productDetails,
            String sizeFitDetails,
            String fabricDetails,
            String careDetails
    ) {}

    static record StyleAnalysis(
            StyleRow row,
            String productSlug,
            GapCategoryMapper.MappingResult mapping,
            LeafCategory preferredLeaf,
            List<String> imageUrls
    ) {
        boolean hasImages() {
            return imageUrls != null && !imageUrls.isEmpty();
        }

        boolean isImportable() {
            return hasImages()
                    && mapping != null
                    && mapping.isImportable()
                    && preferredLeaf != null;
        }
    }

    private record VariantColor(String name, String hex) {}

    private record PricePlan(BigDecimal basePrice, BigDecimal salePrice) {}

    private record ImportCategoryDefinition(
            String name,
            String slug,
            String description,
            String parentSlug,
            int sortOrder
    ) {}
}
