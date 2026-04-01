package vn.edu.hcmuaf.fit.fashionstore.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.hcmuaf.fit.fashionstore.entity.ReturnRequest;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReturnRequestRepository extends JpaRepository<ReturnRequest, UUID> {
    Page<ReturnRequest> findByStatus(ReturnRequest.ReturnStatus status, Pageable pageable);
    Page<ReturnRequest> findByUserId(UUID userId, Pageable pageable);
    Page<ReturnRequest> findByStoreIdOrderByCreatedAtDesc(UUID storeId, Pageable pageable);
    Page<ReturnRequest> findByStoreIdAndStatusOrderByCreatedAtDesc(UUID storeId, ReturnRequest.ReturnStatus status, Pageable pageable);
    Optional<ReturnRequest> findByIdAndStoreId(UUID id, UUID storeId);
    long countByStatus(ReturnRequest.ReturnStatus status);
    Optional<ReturnRequest> findByReturnCode(String returnCode);
    Optional<ReturnRequest> findTopByReturnCodeStartingWithOrderByReturnCodeDesc(String returnCodePrefix);
    List<ReturnRequest> findByReturnCodeIsNullOrderByCreatedAtAscIdAsc();
}
