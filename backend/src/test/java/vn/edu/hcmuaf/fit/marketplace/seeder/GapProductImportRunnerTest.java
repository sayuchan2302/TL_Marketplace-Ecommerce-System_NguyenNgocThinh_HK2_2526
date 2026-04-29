package vn.edu.hcmuaf.fit.marketplace.seeder;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.hcmuaf.fit.marketplace.config.GapSeedProperties;
import vn.edu.hcmuaf.fit.marketplace.dto.request.ProductRequest;
import vn.edu.hcmuaf.fit.marketplace.entity.Category;
import vn.edu.hcmuaf.fit.marketplace.entity.Product;
import vn.edu.hcmuaf.fit.marketplace.entity.ProductVariant;
import vn.edu.hcmuaf.fit.marketplace.entity.Store;
import vn.edu.hcmuaf.fit.marketplace.repository.CategoryRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.FlashSaleCampaignRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.FlashSaleItemRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ProductRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ProductVariantRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreRepository;
import vn.edu.hcmuaf.fit.marketplace.service.ProductService;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GapProductImportRunnerTest {

    @TempDir
    Path tempDir;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private ProductVariantRepository productVariantRepository;

    @Mock
    private FlashSaleCampaignRepository flashSaleCampaignRepository;

    @Mock
    private FlashSaleItemRepository flashSaleItemRepository;

    private FakeProductService productService;
    private GapSeedProperties properties;
    private GapProductImportRunner runner;
    private final ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();

    @BeforeEach
    void setUp() {
        properties = new GapSeedProperties();
        properties.setEnabled(true);
        properties.setTargetCount(6);
        properties.setCleanBeforeImport(true);
        productService = new FakeProductService();
        runner = new GapProductImportRunner(
                properties,
                productService,
                productRepository,
                productVariantRepository,
                storeRepository,
                categoryRepository,
                flashSaleCampaignRepository,
                flashSaleItemRepository
        );
        when(flashSaleCampaignRepository.count()).thenReturn(1L);
    }

    @Test
    void importMapsRowsToExpectedLeafCategories() throws IOException {
        Category menRoot = category("men", null);
        Category womenRoot = category("women", null);
        Category menLeaf = category("men-ao-thun", menRoot);
        Category womenLeaf = category("women-ao-so-mi", womenRoot);

        Store store = Store.builder().id(UUID.randomUUID()).build();

        Path styles = writeStylesCsv(List.of(
                "201,Women,Apparel,Topwear,Shirts,Blue,Summer,2019,Casual,Women Shirt 201",
                "202,Men,Apparel,Topwear,Tshirts,Black,Summer,2019,Casual,Men Tee 202"
        ));
        Path images = writeImagesCsv(List.of(
                "201.jpg,https://img.local/201.jpg",
                "202.jpg,https://img.local/202.jpg"
        ));

        properties.setTargetCount(2);
        properties.setStylesPath(styles.toString());
        properties.setImagesPath(images.toString());
        properties.setCleanBeforeImport(false);

        when(storeRepository.findByApprovalStatusAndStatus(Store.ApprovalStatus.APPROVED, Store.StoreStatus.ACTIVE))
                .thenReturn(List.of(store));
        when(categoryRepository.findAll()).thenReturn(List.of(menRoot, womenRoot, menLeaf, womenLeaf));
        when(productRepository.findBySlugStartingWithIgnoreCase(anyString())).thenReturn(List.of());

        runner.runImport();

        List<ProductRequest> requests = productService.requests;
        assertEquals(2, requests.size());
        assertEquals(List.of(store.getId(), store.getId()), productService.storeIds);

        Map<String, UUID> categoryBySlug = requests.stream()
                .collect(Collectors.toMap(ProductRequest::getSlug, ProductRequest::getCategoryId));
        assertEquals(womenLeaf.getId(), categoryBySlug.get("gap-201"));
        assertEquals(menLeaf.getId(), categoryBySlug.get("gap-202"));
    }

    @Test
    void importDistributesEvenlyAndAppliesFallbackValues() throws IOException {
        Category menRoot = category("men", null);
        Category womenRoot = category("women", null);
        Category accessoriesRoot = category("accessories", null);
        Category menLeaf = category("men-ao-thun", menRoot);
        Category womenLeaf = category("women-ao-kieu", womenRoot);
        Category accessoryLeaf = category("tui-xach", accessoriesRoot);

        UUID storeA = UUID.randomUUID();
        UUID storeB = UUID.randomUUID();
        Store firstStore = Store.builder().id(storeA).build();
        Store secondStore = Store.builder().id(storeB).build();

        Path styles = writeStylesCsv(List.of(
                "100,Men,Apparel,Topwear,Tshirts,NA,,2018,NA,Sample 100",
                "101,Men,Apparel,Topwear,Tshirts,Black,Summer,2018,Casual,Sample 101",
                "102,Men,Apparel,Topwear,Tshirts,White,Summer,2018,Casual,Sample 102",
                "103,Men,Apparel,Topwear,Tshirts,Blue,Summer,2018,Casual,Sample 103",
                "104,Men,Apparel,Topwear,Tshirts,Green,Summer,2018,Casual,Sample 104",
                "105,Men,Apparel,Topwear,Tshirts,Grey,Summer,2018,Casual,Sample 105"
        ));
        Path images = writeImagesCsv(List.of(
                "100.jpg,https://img.local/100.jpg",
                "101.jpg,https://img.local/101.jpg",
                "102.jpg,https://img.local/102.jpg",
                "103.jpg,https://img.local/103.jpg",
                "104.jpg,https://img.local/104.jpg",
                "105.jpg,https://img.local/105.jpg"
        ));

        properties.setTargetCount(6);
        properties.setStylesPath(styles.toString());
        properties.setImagesPath(images.toString());
        properties.setCleanBeforeImport(true);

        Product stale = new Product();
        UUID staleProductId = UUID.randomUUID();
        UUID staleVariantId = UUID.randomUUID();
        stale.setId(staleProductId);
        stale.setSlug("gap-legacy");
        ProductVariant staleVariant = new ProductVariant();
        staleVariant.setId(staleVariantId);

        when(storeRepository.findByApprovalStatusAndStatus(Store.ApprovalStatus.APPROVED, Store.StoreStatus.ACTIVE))
                .thenReturn(List.of(firstStore, secondStore));
        when(categoryRepository.findAll()).thenReturn(List.of(
                menRoot, womenRoot, accessoriesRoot, menLeaf, womenLeaf, accessoryLeaf
        ));
        when(productRepository.findBySlugStartingWithIgnoreCase("gap-")).thenReturn(List.of(stale));
        when(productVariantRepository.findByProductIdIn(List.of(staleProductId))).thenReturn(List.of(staleVariant));
        when(productRepository.save(org.mockito.ArgumentMatchers.any(Product.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        runner.runImport();

        verify(productRepository).deleteAll(List.of(stale));
        verify(productRepository).flush();
        verify(flashSaleItemRepository).deleteByProductIds(List.of(staleProductId));
        verify(flashSaleItemRepository).deleteByVariantIds(List.of(staleVariantId));

        List<ProductRequest> requests = productService.requests;
        List<UUID> storeIds = productService.storeIds;
        assertEquals(6, requests.size());
        assertEquals(6, storeIds.size());

        List<UUID> expectedStoreOrder = List.of(storeA, storeB).stream()
                .sorted(Comparator.comparing(UUID::toString))
                .toList();
        assertEquals(expectedStoreOrder.get(0), storeIds.get(0));
        assertEquals(expectedStoreOrder.get(1), storeIds.get(1));
        assertEquals(expectedStoreOrder.get(0), storeIds.get(2));
        assertEquals(expectedStoreOrder.get(1), storeIds.get(3));
        assertEquals(expectedStoreOrder.get(0), storeIds.get(4));
        assertEquals(expectedStoreOrder.get(1), storeIds.get(5));

        Map<UUID, Long> countByCategory = requests.stream()
                .collect(Collectors.groupingBy(ProductRequest::getCategoryId, Collectors.counting()));
        assertEquals(6L, countByCategory.get(menLeaf.getId()));
        assertTrue(!countByCategory.containsKey(womenLeaf.getId()) || countByCategory.get(womenLeaf.getId()) == 0L);
        assertTrue(!countByCategory.containsKey(accessoryLeaf.getId()) || countByCategory.get(accessoryLeaf.getId()) == 0L);

        ProductRequest fallbackRow = requests.stream()
                .filter(request -> "gap-100".equals(request.getSlug()))
                .findFirst()
                .orElseThrow();

        assertTrue(fallbackRow.getDescription().contains("Usage: Casual."));
        assertTrue(fallbackRow.getDescription().contains("Season: All season."));
        assertNotNull(fallbackRow.getVariants());
        assertEquals("Mixed", fallbackRow.getVariants().get(0).getColor());
    }

    @Test
    void importKeepsSockProductsOnSockLeaf() throws IOException {
        Category accessoriesRoot = category("accessories", null);
        Category backpackLeaf = category("balo", accessoriesRoot);
        Category watchLeaf = category("dong-ho", accessoriesRoot);
        Category scarfLeaf = category("khan", accessoriesRoot);
        Category sockLeaf = category("tat", accessoriesRoot);

        Store store = Store.builder().id(UUID.randomUUID()).build();

        Path styles = writeStylesCsv(List.of(
                "301,Men,Accessories,Fashion Accessories,Accessories,Blue,Summer,2026,Casual,Argyle Varsity Crew Socks",
                "302,Men,Accessories,Fashion Accessories,Accessories,Grey,Summer,2026,Casual,Cable-Knit Crew Socks",
                "303,Men,Accessories,Fashion Accessories,Accessories,Navy,Summer,2026,Casual,City Crew Socks",
                "304,Men,Accessories,Fashion Accessories,Accessories,White,Summer,2026,Casual,CashSoft Crew Socks"
        ));
        Path images = writeImagesCsv(List.of(
                "301.jpg,https://img.local/301.jpg",
                "302.jpg,https://img.local/302.jpg",
                "303.jpg,https://img.local/303.jpg",
                "304.jpg,https://img.local/304.jpg"
        ));

        properties.setTargetCount(4);
        properties.setStylesPath(styles.toString());
        properties.setImagesPath(images.toString());
        properties.setCleanBeforeImport(false);

        when(storeRepository.findByApprovalStatusAndStatus(Store.ApprovalStatus.APPROVED, Store.StoreStatus.ACTIVE))
                .thenReturn(List.of(store));
        when(categoryRepository.findAll()).thenReturn(List.of(
                accessoriesRoot, backpackLeaf, watchLeaf, scarfLeaf, sockLeaf
        ));
        when(productRepository.findBySlugStartingWithIgnoreCase(anyString())).thenReturn(List.of());

        runner.runImport();

        List<ProductRequest> requests = productService.requests;
        assertEquals(4, requests.size());
        for (ProductRequest request : requests) {
            assertEquals(sockLeaf.getId(), request.getCategoryId());
        }
    }

    @Test
    void importCreatesMissingCategoriesNeededForGapMapping() throws IOException {
        Category menRoot = category("men", null);
        Category womenRoot = category("women", null);
        Category accessoriesRoot = category("accessories", null);
        List<Category> categories = new java.util.ArrayList<>(List.of(menRoot, womenRoot, accessoriesRoot));

        Store store = Store.builder().id(UUID.randomUUID()).build();

        Path styles = writeStylesCsv(List.of(
                "401,Men,Accessories,Fashion Accessories,Accessories,White,Summer,2026,Casual,Varsity Crew Socks"
        ));
        Path images = writeImagesCsv(List.of(
                "401.jpg,https://img.local/401.jpg"
        ));

        properties.setTargetCount(1);
        properties.setStylesPath(styles.toString());
        properties.setImagesPath(images.toString());
        properties.setCleanBeforeImport(false);

        when(storeRepository.findByApprovalStatusAndStatus(Store.ApprovalStatus.APPROVED, Store.StoreStatus.ACTIVE))
                .thenReturn(List.of(store));
        when(categoryRepository.findAll()).thenAnswer(invocation -> categories);
        when(categoryRepository.save(org.mockito.ArgumentMatchers.any(Category.class)))
                .thenAnswer(invocation -> {
                    Category saved = invocation.getArgument(0);
                    if (saved.getId() == null) {
                        saved.setId(UUID.randomUUID());
                    }
                    categories.add(saved);
                    return saved;
                });
        when(productRepository.findBySlugStartingWithIgnoreCase(anyString())).thenReturn(List.of());

        runner.runImport();

        Category parent = categories.stream()
                .filter(category -> "accessories-phu-kien-thoi-trang".equals(category.getSlug()))
                .findFirst()
                .orElseThrow();
        Category sockLeaf = categories.stream()
                .filter(category -> "tat".equals(category.getSlug()))
                .findFirst()
                .orElseThrow();

        assertEquals(parent.getId(), sockLeaf.getParent().getId());
        assertEquals(1, productService.requests.size());
        assertEquals(sockLeaf.getId(), productService.requests.get(0).getCategoryId());
    }

    @Test
    void importUsesWordAwareAccessoryMatchingForCashSoftSocks() throws IOException {
        Category accessoriesRoot = category("accessories", null);
        Category accessoriesFashion = category("accessories-phu-kien-thoi-trang", accessoriesRoot);
        Category hatLeaf = category("non-mu", accessoriesFashion);
        Category sockLeaf = category("tat", accessoriesFashion);

        Store store = Store.builder().id(UUID.randomUUID()).build();

        Path styles = writeFullStylesCsv(List.of(
                "501,Men,Accessories,Fashion Accessories,Accessories,White,White,,S/M|M/L,All,2026,Casual,CashSoft Crew Socks,\"Our bestselling fabric that feels cashmere-soft. | Supersoft knit crew socks.\",,,"
        ));
        Path images = writeImagesCsv(List.of(
                "501.jpg,https://img.local/501.jpg"
        ));

        properties.setTargetCount(1);
        properties.setStylesPath(styles.toString());
        properties.setImagesPath(images.toString());
        properties.setCleanBeforeImport(false);

        when(storeRepository.findByApprovalStatusAndStatus(Store.ApprovalStatus.APPROVED, Store.StoreStatus.ACTIVE))
                .thenReturn(List.of(store));
        when(categoryRepository.findAll()).thenReturn(List.of(
                accessoriesRoot, accessoriesFashion, hatLeaf, sockLeaf
        ));
        when(productRepository.findBySlugStartingWithIgnoreCase(anyString())).thenReturn(List.of());

        runner.runImport();

        assertEquals(1, productService.requests.size());
        assertEquals(sockLeaf.getId(), productService.requests.get(0).getCategoryId());
    }

    @Test
    void importDoesNotClassifyTshirtsOrSweatshirtsAsShirts() throws IOException {
        Category menRoot = category("men", null);
        Category menShirtLeaf = category("men-ao-so-mi", menRoot);
        Category menTeeLeaf = category("men-ao-thun", menRoot);
        Category menHoodieLeaf = category("men-ao-hoodie", menRoot);

        Store store = Store.builder().id(UUID.randomUUID()).build();

        Path styles = writeStylesCsv(List.of(
                "601,Men,Apparel,Topwear,Tshirts,White,Summer,2026,Casual,Adult Heavyweight Relaxed T-Shirt",
                "602,Men,Apparel,Topwear,Sweatshirts,Black,Summer,2026,Casual,Adult VintageSoft Arch Logo Hoodie",
                "603,Men,Apparel,Topwear,Shirts,Blue,Summer,2026,Casual,Oxford Button-Down Shirt"
        ));
        Path images = writeImagesCsv(List.of(
                "601.jpg,https://img.local/601.jpg",
                "602.jpg,https://img.local/602.jpg",
                "603.jpg,https://img.local/603.jpg"
        ));

        properties.setTargetCount(3);
        properties.setStylesPath(styles.toString());
        properties.setImagesPath(images.toString());
        properties.setCleanBeforeImport(false);

        when(storeRepository.findByApprovalStatusAndStatus(Store.ApprovalStatus.APPROVED, Store.StoreStatus.ACTIVE))
                .thenReturn(List.of(store));
        when(categoryRepository.findAll()).thenReturn(List.of(
                menRoot, menShirtLeaf, menTeeLeaf, menHoodieLeaf
        ));
        when(productRepository.findBySlugStartingWithIgnoreCase(anyString())).thenReturn(List.of());

        runner.runImport();

        Map<String, UUID> categoryBySlug = productService.requests.stream()
                .collect(Collectors.toMap(ProductRequest::getSlug, ProductRequest::getCategoryId));
        assertEquals(menTeeLeaf.getId(), categoryBySlug.get("gap-601"));
        assertEquals(menHoodieLeaf.getId(), categoryBySlug.get("gap-602"));
        assertEquals(menShirtLeaf.getId(), categoryBySlug.get("gap-603"));
    }

    @Test
    void importSkipsExistingGapSlugsWithoutCreatingDuplicates() throws IOException {
        Category menRoot = category("men", null);
        Category menLeaf = category("men-ao-thun", menRoot);
        Store store = Store.builder().id(UUID.randomUUID()).build();

        Path styles = writeStylesCsv(List.of(
                "701,Men,Apparel,Topwear,Tshirts,White,Summer,2026,Casual,Existing Tee",
                "702,Men,Apparel,Topwear,Tshirts,Black,Summer,2026,Casual,New Tee"
        ));
        Path images = writeImagesCsv(List.of(
                "701.jpg,https://img.local/701.jpg",
                "702.jpg,https://img.local/702.jpg"
        ));

        Product existing = new Product();
        existing.setSlug("gap-701");

        properties.setTargetCount(2);
        properties.setStylesPath(styles.toString());
        properties.setImagesPath(images.toString());
        properties.setCleanBeforeImport(false);

        when(storeRepository.findByApprovalStatusAndStatus(Store.ApprovalStatus.APPROVED, Store.StoreStatus.ACTIVE))
                .thenReturn(List.of(store));
        when(categoryRepository.findAll()).thenReturn(List.of(menRoot, menLeaf));
        when(productRepository.findBySlugStartingWithIgnoreCase(anyString())).thenReturn(List.of(existing));

        runner.runImport();

        assertEquals(1, productService.requests.size());
        assertEquals("gap-702", productService.requests.get(0).getSlug());
    }

    @Test
    void importSkipsUnsupportedAccessorySourceGapRows() throws IOException {
        Category accessoriesRoot = category("accessories", null);
        Category bagLeaf = category("tui-xach", accessoriesRoot);
        Category watchLeaf = category("dong-ho", accessoriesRoot);
        Category jewelryLeaf = category("trang-suc", accessoriesRoot);
        Store store = Store.builder().id(UUID.randomUUID()).build();

        Path styles = writeStylesCsv(List.of(
                "801,Women,Accessories,Fashion Accessories,Accessories,Gold,Summer,2026,Casual,Rose Gold Watch",
                "802,Women,Accessories,Fashion Accessories,Accessories,Silver,Summer,2026,Casual,Statement Necklace"
        ));
        Path images = writeImagesCsv(List.of(
                "801.jpg,https://img.local/801.jpg",
                "802.jpg,https://img.local/802.jpg"
        ));

        properties.setTargetCount(2);
        properties.setStylesPath(styles.toString());
        properties.setImagesPath(images.toString());
        properties.setCleanBeforeImport(false);

        when(storeRepository.findByApprovalStatusAndStatus(Store.ApprovalStatus.APPROVED, Store.StoreStatus.ACTIVE))
                .thenReturn(List.of(store));
        when(categoryRepository.findAll()).thenReturn(List.of(accessoriesRoot, bagLeaf, watchLeaf, jewelryLeaf));
        when(productRepository.findBySlugStartingWithIgnoreCase(anyString())).thenReturn(List.of());

        runner.runImport();

        assertTrue(productService.requests.isEmpty());
    }

    @Test
    void importReportPreservesBeforeSnapshotWhenCleanBeforeImportIsEnabled() throws IOException {
        Category menRoot = category("men", null);
        Category poloLeaf = category("men-ao-polo", menRoot);
        Category teeLeaf = category("men-ao-thun", menRoot);
        Store store = Store.builder().id(UUID.randomUUID()).build();

        Path styles = writeStylesCsv(List.of(
                "901,Men,Apparel,Topwear,Tshirts,White,Summer,2026,Casual,Report Tee"
        ));
        Path images = writeImagesCsv(List.of(
                "901.jpg,https://img.local/901.jpg"
        ));

        Product beforeProduct = product("gap-existing", teeLeaf);
        Product afterExisting = product("gap-existing", teeLeaf);
        Product afterRecovered = product("gap-recovered", poloLeaf);

        properties.setTargetCount(1);
        properties.setStylesPath(styles.toString());
        properties.setImagesPath(images.toString());
        properties.setCleanBeforeImport(true);
        properties.setReportEnabled(true);
        properties.setReportOutputDir(tempDir.resolve("gap-coverage").toString());

        when(storeRepository.findByApprovalStatusAndStatus(Store.ApprovalStatus.APPROVED, Store.StoreStatus.ACTIVE))
                .thenReturn(List.of(store));
        when(categoryRepository.findAll()).thenReturn(List.of(menRoot, poloLeaf, teeLeaf));
        when(productRepository.findBySlugStartingWithIgnoreCase("gap-"))
                .thenReturn(List.of(beforeProduct), List.of(afterExisting, afterRecovered));
        when(productRepository.findAllPublicProducts())
                .thenReturn(List.of(beforeProduct), List.of(afterExisting, afterRecovered));
        when(productRepository.save(org.mockito.ArgumentMatchers.any(Product.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        runner.runImport();

        JsonNode summary = objectMapper.readTree(tempDir.resolve("gap-coverage").resolve("coverage-after.json").toFile())
                .path("summary");

        assertEquals(1, summary.path("nonEmptyLeafCategoryCountBefore").asInt());
        assertEquals(2, summary.path("nonEmptyLeafCategoryCountAfter").asInt());
        assertEquals(List.of("men-ao-polo"), jsonTextList(summary.path("newlyFilledCategories")));
    }

    private Category category(String slug, Category parent) {
        Category category = new Category();
        category.setId(UUID.randomUUID());
        category.setSlug(slug);
        category.setName(slug);
        category.setParent(parent);
        category.setIsVisible(true);
        return category;
    }

    private Product product(String slug, Category category) {
        Product product = new Product();
        product.setId(UUID.randomUUID());
        product.setSlug(slug);
        product.setName(slug);
        product.setCategory(category);
        return product;
    }

    private Path writeStylesCsv(List<String> rows) throws IOException {
        Path path = tempDir.resolve("styles.csv");
        String header = "id,gender,masterCategory,subCategory,articleType,baseColour,season,year,usage,productDisplayName";
        Files.writeString(path, header + System.lineSeparator() + String.join(System.lineSeparator(), rows));
        return path;
    }

    private Path writeFullStylesCsv(List<String> rows) throws IOException {
        Path path = tempDir.resolve("styles-full.csv");
        String header = "id,gender,masterCategory,subCategory,articleType,baseColour,colorOptions,colorHexOptions,sizeOptions,season,year,usage,productDisplayName,productDetails,sizeFitDetails,fabricDetails,careDetails";
        Files.writeString(path, header + System.lineSeparator() + String.join(System.lineSeparator(), rows));
        return path;
    }

    private Path writeImagesCsv(List<String> rows) throws IOException {
        Path path = tempDir.resolve("images.csv");
        String header = "filename,link";
        Files.writeString(path, header + System.lineSeparator() + String.join(System.lineSeparator(), rows));
        return path;
    }

    private static class FakeProductService extends ProductService {
        private final List<ProductRequest> requests = new java.util.ArrayList<>();
        private final List<UUID> storeIds = new java.util.ArrayList<>();

        FakeProductService() {
            super(null, null, null, null, null);
        }

        @Override
        public Product createForStore(ProductRequest request, UUID storeId) {
            requests.add(request);
            storeIds.add(storeId);
            Product product = new Product();
            product.setId(UUID.randomUUID());
            return product;
        }
    }

    private List<String> jsonTextList(JsonNode arrayNode) {
        List<String> values = new ArrayList<>();
        for (JsonNode node : arrayNode) {
            values.add(node.asText());
        }
        return values;
    }
}
