package vn.edu.hcmuaf.fit.marketplace.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import vn.edu.hcmuaf.fit.marketplace.config.VisionSearchProperties;
import vn.edu.hcmuaf.fit.marketplace.dto.response.MarketplaceImageSearchResponse;
import vn.edu.hcmuaf.fit.marketplace.entity.Product;
import vn.edu.hcmuaf.fit.marketplace.entity.ProductImage;
import vn.edu.hcmuaf.fit.marketplace.entity.Store;
import vn.edu.hcmuaf.fit.marketplace.repository.CategoryRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.FlashSaleCampaignRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.FlashSaleItemRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.OrderRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ProductRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MarketplacePublicServiceImageSearchTest {

    @Mock
    private ProductRepository productRepository;

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private CategoryRepository categoryRepository;

    @Mock
    private FlashSaleCampaignRepository flashSaleCampaignRepository;

    @Mock
    private FlashSaleItemRepository flashSaleItemRepository;

    @Mock
    private OrderRepository orderRepository;

    private MarketplacePublicService marketplacePublicService;
    private StubVisionSearchClient visionSearchClient;
    private VisionSearchProperties visionSearchProperties;

    @BeforeEach
    void setUp() {
        visionSearchProperties = new VisionSearchProperties();
        visionSearchProperties.setMaxCandidates(120);
        visionSearchProperties.setMaxUploadSizeBytes(5_242_880L);
        visionSearchClient = new StubVisionSearchClient(visionSearchProperties);
        StorePerformanceMetricsService storePerformanceMetricsService = new StorePerformanceMetricsService(orderRepository);

        marketplacePublicService = new MarketplacePublicService(
                productRepository,
                storeRepository,
                categoryRepository,
                flashSaleCampaignRepository,
                flashSaleItemRepository,
                storePerformanceMetricsService,
                visionSearchClient,
                visionSearchProperties
        );
    }

    @Test
    void searchProductsByImagePreservesVisionRankingAndSkipsMissingProducts() {
        UUID firstId = UUID.randomUUID();
        UUID secondId = UUID.randomUUID();
        UUID staleId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();

        Product first = buildProduct(firstId, storeId, "first-product", "First Product", "/uploads/products/first.jpg");
        Product second = buildProduct(secondId, storeId, "second-product", "Second Product", "/uploads/products/second.jpg");
        Store store = Store.builder()
                .id(storeId)
                .name("Vision Store")
                .slug("vision-store")
                .status(Store.StoreStatus.ACTIVE)
                .approvalStatus(Store.ApprovalStatus.APPROVED)
                .build();

        visionSearchClient.setResult(new VisionSearchClient.VisionSearchResult(
                List.of(
                        new VisionSearchClient.VisionCandidate(secondId, 0.91, "/uploads/products/second.jpg", 0, true),
                        new VisionSearchClient.VisionCandidate(staleId, 0.88, "/uploads/products/stale.jpg", 0, true),
                        new VisionSearchClient.VisionCandidate(firstId, 0.83, "/uploads/products/first.jpg", 0, true)
                ),
                3,
                "sync-2026-04-27"
        ));
        when(productRepository.findPublicMarketplaceProductsByIds(List.of(secondId, staleId, firstId)))
                .thenReturn(List.of(first, second));
        when(storeRepository.findAllById(any()))
                .thenReturn(List.of(store));

        MockMultipartFile file = new MockMultipartFile("file", "query.jpg", "image/jpeg", new byte[] {1, 2, 3});
        MarketplaceImageSearchResponse response = marketplacePublicService.searchProductsByImage(file, 120);

        assertEquals(2, response.getItems().size());
        assertEquals("Second Product", response.getItems().get(0).getName());
        assertEquals("First Product", response.getItems().get(1).getName());
        assertEquals(3, response.getTotalCandidates());
        assertEquals("image", response.getMode());
        assertEquals("sync-2026-04-27", response.getIndexVersion());
    }

    private Product buildProduct(UUID productId, UUID storeId, String slug, String name, String imageUrl) {
        ProductImage image = ProductImage.builder()
                .url(imageUrl)
                .isPrimary(true)
                .sortOrder(0)
                .build();

        Product product = Product.builder()
                .id(productId)
                .slug(slug)
                .sku(slug.toUpperCase())
                .name(name)
                .storeId(storeId)
                .basePrice(new BigDecimal("199000"))
                .salePrice(new BigDecimal("149000"))
                .status(Product.ProductStatus.ACTIVE)
                .approvalStatus(Product.ApprovalStatus.APPROVED)
                .images(List.of(image))
                .variants(List.of())
                .build();
        image.setProduct(product);
        return product;
    }

    private static final class StubVisionSearchClient extends VisionSearchClient {
        private VisionSearchResult result = new VisionSearchResult(List.of(), 0, null);

        private StubVisionSearchClient(VisionSearchProperties properties) {
            super(properties, new ObjectMapper());
        }

        @Override
        public VisionSearchResult searchImage(org.springframework.web.multipart.MultipartFile file, int limit) {
            return result;
        }

        private void setResult(VisionSearchResult result) {
            this.result = result;
        }
    }
}
