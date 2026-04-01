package vn.edu.hcmuaf.fit.fashionstore.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductAuditLog;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProductAuditLogRepository extends JpaRepository<ProductAuditLog, UUID> {

    List<ProductAuditLog> findByProductIdOrderByCreatedAtDesc(UUID productId);
}
