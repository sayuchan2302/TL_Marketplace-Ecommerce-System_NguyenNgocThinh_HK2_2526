package vn.edu.hcmuaf.fit.marketplace.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.hcmuaf.fit.marketplace.dto.response.StoreResponse;
import vn.edu.hcmuaf.fit.marketplace.entity.Product;
import vn.edu.hcmuaf.fit.marketplace.entity.Store;
import vn.edu.hcmuaf.fit.marketplace.entity.User;
import vn.edu.hcmuaf.fit.marketplace.repository.OrderRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ProductRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ReviewRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.UserRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreServiceAggregatesTest {

    @Mock
    private StoreRepository storeRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private ProductRepository productRepository;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private ReviewRepository reviewRepository;

    private StoreService storeService;

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        StorePerformanceMetricsService storePerformanceMetricsService = new StorePerformanceMetricsService(orderRepository);
        storeService = new StoreService(
                storeRepository,
                userRepository,
                productRepository,
                reviewRepository,
                storePerformanceMetricsService
        );
    }

    @Test
    void adminStoreListIncludesAggregateMetrics() {
        User owner = User.builder()
                .id(UUID.randomUUID())
                .email("vendor@test.local")
                .password("hashed")
                .name("Vendor")
                .role(User.Role.VENDOR)
                .isActive(true)
                .build();

        Store store = Store.builder()
                .id(UUID.randomUUID())
                .owner(owner)
                .name("Demo Store")
                .slug("demo-store")
                .approvalStatus(Store.ApprovalStatus.APPROVED)
                .status(Store.StoreStatus.ACTIVE)
                .build();

        when(storeRepository.findAll()).thenReturn(List.of(store));
        when(productRepository.countByStoreIdExcludingArchived(store.getId())).thenReturn(12L);
        when(productRepository.countByStoreIdAndStatus(store.getId(), Product.ProductStatus.ACTIVE)).thenReturn(9L);
        when(orderRepository.countByStoreId(store.getId())).thenReturn(5L);
        when(orderRepository.calculateRevenueByStoreId(store.getId())).thenReturn(new BigDecimal("250000"));
        when(reviewRepository.countByStoreId(store.getId())).thenReturn(10L);
        when(reviewRepository.countByStoreIdWithReply(store.getId())).thenReturn(7L);

        List<StoreResponse> rows = storeService.getAllStoresForAdmin();
        assertEquals(1, rows.size());
        assertEquals(12, rows.get(0).getProductCount());
        assertEquals(9, rows.get(0).getLiveProductCount());
        assertEquals(70, rows.get(0).getResponseRate());
        assertEquals(5, rows.get(0).getTotalOrders());
        assertEquals(0, rows.get(0).getTotalSales().compareTo(new BigDecimal("250000")));
    }
}
