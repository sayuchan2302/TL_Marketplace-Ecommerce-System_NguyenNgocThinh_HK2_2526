package vn.edu.hcmuaf.fit.marketplace.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.hcmuaf.fit.marketplace.dto.request.StoreRequest;
import vn.edu.hcmuaf.fit.marketplace.entity.Store;
import vn.edu.hcmuaf.fit.marketplace.entity.User;
import vn.edu.hcmuaf.fit.marketplace.repository.OrderRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ProductRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ReviewRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.UserRepository;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class StoreServiceBankVerificationTest {

    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;
    @Mock private ProductRepository productRepository;
    @Mock private ReviewRepository reviewRepository;
    @Mock private OrderRepository orderRepository;

    private StoreService storeService;

    @BeforeEach
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
    void vendorUpdateStoreIgnoresBankVerifiedField() {
        UUID userId = UUID.randomUUID();
        User owner = User.builder()
                .id(userId)
                .email("vendor@example.com")
                .password("hashed")
                .name("Vendor")
                .role(User.Role.VENDOR)
                .build();
        Store store = Store.builder()
                .id(UUID.randomUUID())
                .owner(owner)
                .name("Store")
                .slug("store")
                .bankVerified(false)
                .status(Store.StoreStatus.ACTIVE)
                .approvalStatus(Store.ApprovalStatus.APPROVED)
                .build();

        when(storeRepository.findByOwnerId(userId)).thenReturn(Optional.of(store));
        when(storeRepository.save(any(Store.class))).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.countByStoreId(store.getId())).thenReturn(0L);
        when(orderRepository.calculateRevenueByStoreId(store.getId())).thenReturn(BigDecimal.ZERO);

        StoreRequest request = StoreRequest.builder()
                .bankVerified(true)
                .description("updated")
                .build();

        storeService.updateStore(userId, request);

        assertFalse(Boolean.TRUE.equals(store.getBankVerified()));
    }

    @Test
    void adminUpdateBankVerificationUpdatesFlag() {
        UUID storeId = UUID.randomUUID();
        User owner = User.builder()
                .id(UUID.randomUUID())
                .email("vendor@example.com")
                .password("hashed")
                .name("Vendor")
                .role(User.Role.VENDOR)
                .build();
        Store store = Store.builder()
                .id(storeId)
                .owner(owner)
                .name("Store")
                .slug("store")
                .bankVerified(false)
                .status(Store.StoreStatus.ACTIVE)
                .approvalStatus(Store.ApprovalStatus.APPROVED)
                .build();

        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(storeRepository.save(any(Store.class))).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.countByStoreId(storeId)).thenReturn(0L);
        when(orderRepository.calculateRevenueByStoreId(storeId)).thenReturn(BigDecimal.ZERO);

        storeService.updateBankVerification(storeId, true, UUID.randomUUID(), "admin@example.com", "KYC approved");

        assertTrue(Boolean.TRUE.equals(store.getBankVerified()));
    }

    @Test
    void adminUpdateCommissionRateUpdatesStoreRate() {
        UUID storeId = UUID.randomUUID();
        User owner = User.builder()
                .id(UUID.randomUUID())
                .email("vendor@example.com")
                .password("hashed")
                .name("Vendor")
                .role(User.Role.VENDOR)
                .build();
        Store store = Store.builder()
                .id(storeId)
                .owner(owner)
                .name("Store")
                .slug("store")
                .commissionRate(new BigDecimal("5.0"))
                .status(Store.StoreStatus.ACTIVE)
                .approvalStatus(Store.ApprovalStatus.APPROVED)
                .build();

        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(storeRepository.save(any(Store.class))).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.countByStoreId(storeId)).thenReturn(0L);
        when(orderRepository.calculateRevenueByStoreId(storeId)).thenReturn(BigDecimal.ZERO);

        storeService.updateCommissionRateAsAdmin(storeId, new BigDecimal("7.5"), UUID.randomUUID(), "admin@example.com");

        assertEquals(0, store.getCommissionRate().compareTo(new BigDecimal("7.5")));
    }

    @Test
    void adminUpdateCommissionRateRejectsOutOfRangeValues() {
        assertThrows(
                ResponseStatusException.class,
                () -> storeService.updateCommissionRateAsAdmin(
                        UUID.randomUUID(),
                        BigDecimal.ZERO,
                        UUID.randomUUID(),
                        "admin@example.com"
                )
        );
    }
}
