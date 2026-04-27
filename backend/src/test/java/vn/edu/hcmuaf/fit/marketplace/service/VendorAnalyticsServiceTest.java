package vn.edu.hcmuaf.fit.marketplace.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.edu.hcmuaf.fit.marketplace.dto.response.VendorAnalyticsResponse;
import vn.edu.hcmuaf.fit.marketplace.entity.Store;
import vn.edu.hcmuaf.fit.marketplace.repository.OrderRepository;
import vn.edu.hcmuaf.fit.marketplace.repository.StoreRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VendorAnalyticsServiceTest {

    @Mock private OrderRepository orderRepository;
    @Mock private StoreRepository storeRepository;

    private VendorAnalyticsService vendorAnalyticsService;

    @BeforeEach
    void setUp() {
        vendorAnalyticsService = new VendorAnalyticsService(orderRepository, storeRepository);
    }

    @Test
    void getAnalyticsUsesCurrentStoreCommissionRateFromBackend() {
        UUID storeId = UUID.randomUUID();
        Store store = Store.builder()
                .id(storeId)
                .commissionRate(new BigDecimal("7.5"))
                .build();

        when(storeRepository.findById(storeId)).thenReturn(Optional.of(store));
        when(orderRepository.findPeriodSummaryByStoreBetween(eq(storeId), any(), any())).thenReturn(List.of());
        when(orderRepository.findDailySeriesByStoreBetween(eq(storeId), any(), any())).thenReturn(List.of());
        when(orderRepository.countDistinctCustomersByStoreBetween(eq(storeId), any(), any())).thenReturn(0L);

        VendorAnalyticsResponse response = vendorAnalyticsService.getAnalytics(storeId);

        assertEquals(0, response.getCommissionRate().compareTo(new BigDecimal("7.5")));
    }
}
