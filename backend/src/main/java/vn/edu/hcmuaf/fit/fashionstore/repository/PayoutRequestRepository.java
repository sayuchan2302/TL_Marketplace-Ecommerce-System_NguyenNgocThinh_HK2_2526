package vn.edu.hcmuaf.fit.fashionstore.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.hcmuaf.fit.fashionstore.entity.PayoutRequest;

import jakarta.persistence.LockModeType;
import java.util.UUID;

@Repository
public interface PayoutRequestRepository extends JpaRepository<PayoutRequest, UUID> {

    Page<PayoutRequest> findByStatus(PayoutRequest.PayoutStatus status, Pageable pageable);

    Page<PayoutRequest> findByStoreId(UUID storeId, Pageable pageable);

    Page<PayoutRequest> findByStoreIdAndStatus(UUID storeId, PayoutRequest.PayoutStatus status, Pageable pageable);

    long countByStatus(PayoutRequest.PayoutStatus status);

    @Query("SELECT COALESCE(SUM(pr.amount), 0) FROM PayoutRequest pr WHERE pr.status = 'PENDING'")
    java.math.BigDecimal sumPendingAmount();

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT pr FROM PayoutRequest pr WHERE pr.id = :id")
    java.util.Optional<PayoutRequest> findByIdForUpdate(@Param("id") UUID id);
}
