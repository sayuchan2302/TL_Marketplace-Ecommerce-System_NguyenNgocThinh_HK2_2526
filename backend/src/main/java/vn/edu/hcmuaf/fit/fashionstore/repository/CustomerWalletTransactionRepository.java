package vn.edu.hcmuaf.fit.fashionstore.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import vn.edu.hcmuaf.fit.fashionstore.entity.CustomerWalletTransaction;

import java.math.BigDecimal;
import java.util.UUID;

@Repository
public interface CustomerWalletTransactionRepository extends JpaRepository<CustomerWalletTransaction, UUID> {
    boolean existsByReturnRequestIdAndType(UUID returnRequestId, CustomerWalletTransaction.TransactionType type);

    @Query("""
            SELECT COALESCE(SUM(t.amount), 0)
            FROM CustomerWalletTransaction t
            WHERE t.orderId = :orderId
              AND t.type = :type
            """)
    BigDecimal sumAmountByOrderIdAndType(UUID orderId, CustomerWalletTransaction.TransactionType type);
}
