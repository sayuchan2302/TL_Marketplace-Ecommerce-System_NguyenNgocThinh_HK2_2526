package vn.edu.hcmuaf.fit.marketplace.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.hcmuaf.fit.marketplace.entity.CommissionTier;
import vn.edu.hcmuaf.fit.marketplace.entity.Store;
import vn.edu.hcmuaf.fit.marketplace.entity.User;
import vn.edu.hcmuaf.fit.marketplace.repository.CommissionTierRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.OrderRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ProductRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.ReviewRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.UserRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CommissionTierServiceTest {

    @Mock private CommissionTierRepository commissionTierRepository;
    @Mock private StoreRepository storeRepository;
    @Mock private UserRepository userRepository;
    @Mock private ProductRepository productRepository;
    @Mock private ReviewRepository reviewRepository;
    @Mock private OrderRepository orderRepository;

    private CommissionTierService commissionTierService;
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
        commissionTierService = new CommissionTierService(commissionTierRepository, storeService);
    }

    @Test
    void determineTierForVendorUsesHighestEligibleSortOrder() {
        CommissionTier starter = CommissionTier.builder()
                .id(UUID.randomUUID())
                .name("Starter")
                .slug("starter")
                .rate(new BigDecimal("6.0"))
                .minMonthlyRevenue(0L)
                .minOrderCount(0)
                .isActive(true)
                .sortOrder(10)
                .build();
        CommissionTier vip = CommissionTier.builder()
                .id(UUID.randomUUID())
                .name("VIP")
                .slug("vip")
                .rate(new BigDecimal("4.0"))
                .minMonthlyRevenue(1_000_000L)
                .minOrderCount(10)
                .isActive(true)
                .sortOrder(50)
                .build();

        when(commissionTierRepository.findByIsActiveTrueOrderBySortOrderAsc())
                .thenReturn(List.of(starter, vip));

        CommissionTier resolved = commissionTierService.determineTierForVendor(2_000_000L, 20);

        assertEquals(vip.getId(), resolved.getId());
    }

    @Test
    void applyTierToStoreCopiesTierRateIntoStoreCommissionRate() {
        UUID tierId = UUID.randomUUID();
        UUID storeId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
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
        CommissionTier tier = CommissionTier.builder()
                .id(tierId)
                .name("Gold")
                .slug("gold")
                .rate(new BigDecimal("3.5"))
                .isActive(true)
                .build();

        when(commissionTierRepository.findById(tierId)).thenReturn(Optional.of(tier));
        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(storeRepository.save(any(Store.class))).thenAnswer(inv -> inv.getArgument(0));
        when(orderRepository.countByStoreId(storeId)).thenReturn(0L);
        when(orderRepository.calculateRevenueByStoreId(storeId)).thenReturn(BigDecimal.ZERO);

        commissionTierService.applyTierToStore(tierId, storeId, adminId, "admin@example.com");

        assertEquals(0, store.getCommissionRate().compareTo(new BigDecimal("3.5")));
    }
}
