package vn.edu.hcmuaf.fit.fashionstore.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.hcmuaf.fit.fashionstore.entity.ProductVariant;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductVariantRepository extends JpaRepository<ProductVariant, UUID> {

    Optional<ProductVariant> findBySku(String sku);

    Optional<ProductVariant> findByProductIdAndColorAndSize(UUID productId, String color, String size);

    @Query("""
            SELECT v FROM ProductVariant v
            WHERE UPPER(v.sku) = UPPER(:sku)
              AND v.product.id <> :productId
            """)
    Optional<ProductVariant> findConflictingSku(@Param("sku") String sku, @Param("productId") UUID productId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT v FROM ProductVariant v WHERE v.id = :id")
    Optional<ProductVariant> findByIdForUpdate(@Param("id") UUID id);

    @Query("""
            SELECT v FROM ProductVariant v
            WHERE v.product.id = :productId
              AND COALESCE(v.isActive, true) = true
            """)
    List<ProductVariant> findByProductIdAndIsActiveTrue(@Param("productId") UUID productId);

    @Query("""
            SELECT COALESCE(SUM(v.stockQuantity), 0)
            FROM ProductVariant v
            WHERE v.product.id = :productId
              AND COALESCE(v.isActive, true) = true
            """)
    Long sumActiveStockByProductId(@Param("productId") UUID productId);
}
