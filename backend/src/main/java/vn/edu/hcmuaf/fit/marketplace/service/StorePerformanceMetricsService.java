package vn.edu.hcmuaf.fit.marketplace.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmuaf.fit.marketplace.repository.OrderRepository;

import java.math.BigDecimal;
import java.util.UUID;

@Service
public class StorePerformanceMetricsService {

    private final OrderRepository orderRepository;

    public StorePerformanceMetricsService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public StorePerformanceMetrics resolve(UUID storeId) {
        if (storeId == null) {
            return StorePerformanceMetrics.empty();
        }

        long totalOrders = orderRepository.countByStoreId(storeId);
        BigDecimal totalSales = orderRepository.calculateRevenueByStoreId(storeId);

        return new StorePerformanceMetrics(
                Math.toIntExact(totalOrders),
                totalSales != null ? totalSales : BigDecimal.ZERO
        );
    }

    public record StorePerformanceMetrics(
            int totalOrders,
            BigDecimal totalSales
    ) {
        static StorePerformanceMetrics empty() {
            return new StorePerformanceMetrics(0, BigDecimal.ZERO);
        }
    }
}
