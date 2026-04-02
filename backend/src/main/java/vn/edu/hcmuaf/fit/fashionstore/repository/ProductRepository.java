package vn.edu.hcmuaf.fit.fashionstore.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ProductRepository extends JpaRepository<Product, UUID>, JpaSpecificationExecutor<Product> {

    Optional<Product> findBySlug(String slug);

    Optional<Product> findBySku(String sku);

    boolean existsBySlugIgnoreCase(String slug);

    boolean existsBySlugIgnoreCaseAndIdNot(String slug, UUID id);

    @Query("""
            SELECT p FROM Product p
            WHERE p.status = 'ACTIVE'
              AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)
              AND p.storeId IS NOT NULL
              AND p.storeId IN (
                  SELECT s.id FROM Store s
                  WHERE s.approvalStatus = 'APPROVED'
                    AND s.status = 'ACTIVE'
              )
            """)
    List<Product> findAllPublicProducts();

    @Query("""
            SELECT p FROM Product p
            WHERE p.id = :id
              AND p.status = 'ACTIVE'
              AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)
              AND p.storeId IS NOT NULL
              AND p.storeId IN (
                  SELECT s.id FROM Store s
                  WHERE s.approvalStatus = 'APPROVED'
                    AND s.status = 'ACTIVE'
              )
            """)
    Optional<Product> findPublicById(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            SELECT p FROM Product p
            WHERE p.id = :id
              AND p.status = 'ACTIVE'
              AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)
              AND p.storeId IS NOT NULL
              AND p.storeId IN (
                  SELECT s.id FROM Store s
                  WHERE s.approvalStatus = 'APPROVED'
                    AND s.status = 'ACTIVE'
              )
            """)
    Optional<Product> findPublicByIdForUpdate(@Param("id") UUID id);

    @Query("""
            SELECT p FROM Product p
            WHERE p.slug = :slug
              AND p.status = 'ACTIVE'
              AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)
              AND p.storeId IS NOT NULL
              AND p.storeId IN (
                  SELECT s.id FROM Store s
                  WHERE s.approvalStatus = 'APPROVED'
                    AND s.status = 'ACTIVE'
              )
            """)
    Optional<Product> findPublicBySlug(@Param("slug") String slug);

    @Query("""
            SELECT DISTINCT p FROM Product p
            LEFT JOIN p.variants v
            WHERE (
                LOWER(COALESCE(p.sku, '')) = LOWER(:sku)
                OR LOWER(COALESCE(v.sku, '')) = LOWER(:sku)
            )
              AND p.status = 'ACTIVE'
              AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)
              AND p.storeId IS NOT NULL
              AND p.storeId IN (
                  SELECT s.id FROM Store s
                  WHERE s.approvalStatus = 'APPROVED'
                    AND s.status = 'ACTIVE'
              )
            """)
    Optional<Product> findPublicBySku(@Param("sku") String sku);

    Page<Product> findByCategoryId(UUID categoryId, Pageable pageable);

    Page<Product> findByStatus(Product.ProductStatus status, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.isFeatured = true AND p.status = 'ACTIVE' AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)")
    List<Product> findFeaturedProducts(Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.status = 'ACTIVE' AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL) AND " +
            "(LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(p.description) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<Product> searchProducts(String keyword, Pageable pageable);

    @EntityGraph(attributePaths = {"category", "images"})
    @Query("""
            SELECT p FROM Product p
            WHERE p.status = 'ACTIVE'
              AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)
              AND p.storeId IS NOT NULL
              AND p.storeId IN (
                  SELECT s.id FROM Store s
                  WHERE s.approvalStatus = 'APPROVED'
                    AND s.status = 'ACTIVE'
              )
            """)
    Page<Product> findPublicMarketplaceProducts(Pageable pageable);

    @EntityGraph(attributePaths = {"category", "images"})
    @Query("""
            SELECT p FROM Product p
            WHERE p.status = 'ACTIVE'
              AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)
              AND COALESCE(p.isFeatured, false) = true
              AND p.storeId IS NOT NULL
              AND p.storeId IN (
                  SELECT s.id FROM Store s
                  WHERE s.approvalStatus = 'APPROVED'
                    AND s.status = 'ACTIVE'
              )
            """)
    Page<Product> findPublicFeaturedMarketplaceProducts(Pageable pageable);

    @EntityGraph(attributePaths = {"category", "images"})
    @Query("""
            SELECT DISTINCT p FROM Product p
            WHERE p.status = 'ACTIVE'
              AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)
              AND p.storeId IS NOT NULL
              AND p.storeId IN (
                  SELECT s.id FROM Store s
                  WHERE s.approvalStatus = 'APPROVED'
                    AND s.status = 'ACTIVE'
              )
              AND (
                COALESCE(:keyword, '') = ''
                OR LOWER(COALESCE(p.name, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(COALESCE(p.description, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
                OR LOWER(COALESCE(p.sku, '')) LIKE LOWER(CONCAT('%', :keyword, '%'))
              )
            """)
    Page<Product> searchPublicMarketplaceProducts(
            @Param("keyword") String keyword,
            Pageable pageable
    );

    @Query("SELECT DISTINCT p FROM Product p LEFT JOIN FETCH p.images WHERE p.id = :id")
    Optional<Product> findByIdWithDetails(UUID id);

    // ─── Multi-vendor: Store-scoped queries ────────────────────────────────────
    
    /**
     * Find all products belonging to a specific store (vendor)
     */
    @EntityGraph(attributePaths = {"category"})
    Page<Product> findByStoreId(UUID storeId, Pageable pageable);

    /**
     * Find active products for a store
     */
    @Query("""
            SELECT p FROM Product p
            WHERE p.storeId = :storeId
              AND p.status = 'ACTIVE'
              AND (p.approvalStatus = 'APPROVED' OR p.approvalStatus IS NULL)
              AND p.storeId IN (
                  SELECT s.id FROM Store s
                  WHERE s.approvalStatus = 'APPROVED'
                    AND s.status = 'ACTIVE'
              )
            """)
    Page<Product> findActiveByStoreId(@Param("storeId") UUID storeId, Pageable pageable);

    /**
     * Find product by ID only if it belongs to the specified store (ownership check)
     */
    @EntityGraph(attributePaths = {"category"})
    Optional<Product> findByIdAndStoreId(UUID id, UUID storeId);

    @Override
    @EntityGraph(attributePaths = {"category", "images"})
    Page<Product> findAll(org.springframework.data.jpa.domain.Specification<Product> spec, Pageable pageable);

    /**
     * Search products within a specific store
     */
    @Query("SELECT p FROM Product p WHERE p.storeId = :storeId AND p.status = 'ACTIVE' AND " +
            "(LOWER(p.name) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
            "LOWER(p.description) LIKE LOWER(CONCAT('%', :keyword, '%')))")
    Page<Product> searchProductsByStore(@Param("storeId") UUID storeId, @Param("keyword") String keyword, Pageable pageable);

    /**
     * Find products by category within a specific store
     */
    Page<Product> findByStoreIdAndCategoryId(UUID storeId, UUID categoryId, Pageable pageable);

    /**
     * Count products by store (for vendor dashboard)
     */
    long countByStoreId(UUID storeId);

    @Query("SELECT COUNT(p) FROM Product p WHERE p.storeId = :storeId AND p.status = :status")
    long countByStoreIdAndStatus(@Param("storeId") UUID storeId, @Param("status") Product.ProductStatus status);

    @Query("""
            SELECT COUNT(p) FROM Product p
            WHERE p.storeId = :storeId
              AND p.status <> 'ARCHIVED'
            """)
    long countByStoreIdExcludingArchived(@Param("storeId") UUID storeId);

    /**
     * Count active products by store
     */
    @Query("SELECT COUNT(p) FROM Product p WHERE p.storeId = :storeId AND p.status = 'ACTIVE'")
    long countActiveByStoreId(@Param("storeId") UUID storeId);

    @Query("""
            SELECT COUNT(p) FROM Product p
            WHERE p.storeId = :storeId
              AND p.status = 'ACTIVE'
              AND (
                SELECT COALESCE(SUM(v.stockQuantity), 0)
                FROM ProductVariant v
                WHERE v.product = p
                  AND COALESCE(v.isActive, true) = true
              ) <= 0
            """)
    long countOutOfStockByStoreId(@Param("storeId") UUID storeId);

    @Query("""
            SELECT COUNT(p) FROM Product p
            WHERE p.storeId = :storeId
              AND p.status = 'ACTIVE'
              AND (
                SELECT COALESCE(SUM(v.stockQuantity), 0)
                FROM ProductVariant v
                WHERE v.product = p
                  AND COALESCE(v.isActive, true) = true
              ) > 0
              AND (
                SELECT COALESCE(SUM(v.stockQuantity), 0)
                FROM ProductVariant v
                WHERE v.product = p
                  AND COALESCE(v.isActive, true) = true
              ) < :threshold
            """)
    long countLowStockByStoreId(@Param("storeId") UUID storeId, @Param("threshold") int threshold);

    @Query("""
            SELECT p FROM Product p
            LEFT JOIN p.category c
            WHERE p.storeId = :storeId
              AND (
                :status IS NULL
                OR (:status = 'DRAFT' AND p.status IN ('DRAFT', 'INACTIVE'))
                OR p.status = :status
              )
              AND (:categoryId IS NULL OR c.id = :categoryId)
              AND (
                COALESCE(:keyword, '') = ''
                OR LOWER(COALESCE(p.name, '')) LIKE LOWER(CONCAT('%', COALESCE(:keyword, ''), '%'))
                OR LOWER(COALESCE(p.slug, '')) LIKE LOWER(CONCAT('%', COALESCE(:keyword, ''), '%'))
                OR LOWER(COALESCE(c.name, '')) LIKE LOWER(CONCAT('%', COALESCE(:keyword, ''), '%'))
              )
              AND (
                :inventoryState IS NULL
                OR (
                  :inventoryState = 'OUT'
                  AND (
                    SELECT COALESCE(SUM(v.stockQuantity), 0)
                    FROM ProductVariant v
                    WHERE v.product = p
                      AND COALESCE(v.isActive, true) = true
                  ) <= 0
                )
                OR (
                  :inventoryState = 'LOW'
                  AND (
                    SELECT COALESCE(SUM(v.stockQuantity), 0)
                    FROM ProductVariant v
                    WHERE v.product = p
                      AND COALESCE(v.isActive, true) = true
                  ) > 0
                  AND (
                    SELECT COALESCE(SUM(v.stockQuantity), 0)
                    FROM ProductVariant v
                    WHERE v.product = p
                      AND COALESCE(v.isActive, true) = true
                  ) < :lowStockThreshold
                )
              )
              AND p.status <> 'ARCHIVED'
            """)
    Page<Product> searchVendorProducts(
            @Param("storeId") UUID storeId,
            @Param("status") Product.ProductStatus status,
            @Param("keyword") String keyword,
            @Param("categoryId") UUID categoryId,
            @Param("inventoryState") String inventoryState,
            @Param("lowStockThreshold") int lowStockThreshold,
            Pageable pageable
    );

    @Query("""
            SELECT c.id, COUNT(p)
            FROM Product p
            JOIN p.category c
            WHERE p.status = 'ACTIVE'
            GROUP BY c.id
            ORDER BY COUNT(p) DESC
            """)
    List<Object[]> countActiveProductsByCategory(Pageable pageable);
}
