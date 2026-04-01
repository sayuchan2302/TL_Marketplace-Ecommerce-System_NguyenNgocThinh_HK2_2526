package vn.edu.hcmuaf.fit.fashionstore.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "products")
public class Product extends BaseEntity {

    @Column(nullable = false)
    private String name;

    @Column(unique = true)
    private String slug;

    @Column(unique = true)
    private String sku;

    @Column(name = "stock_quantity")
    @Builder.Default
    private Integer stockQuantity = 0;

    @Column(name = "store_id")
    private UUID storeId;

    @Column(columnDefinition = "text")
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(name = "base_price")
    private BigDecimal basePrice;

    @Column(name = "sale_price")
    private BigDecimal salePrice;

    private String material;

    private String fit;

    @Enumerated(EnumType.STRING)
    private Gender gender;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    @Builder.Default
    private ProductStatus status = ProductStatus.ACTIVE;

    @Enumerated(EnumType.STRING)
    @Column(name = "approval_status", length = 20)
    @Builder.Default
    private ApprovalStatus approvalStatus = ApprovalStatus.PENDING;

    @Column(name = "is_featured")
    @Builder.Default
    private Boolean isFeatured = false;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductImage> images = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductVariant> variants = new ArrayList<>();

    @Builder.Default
    private Integer viewCount = 0;

    public enum Gender {
        MALE, FEMALE, UNISEX
    }

    public enum ProductStatus {
        ACTIVE, INACTIVE, DRAFT, ARCHIVED
    }

    public enum ApprovalStatus {
        PENDING, APPROVED, REJECTED, BANNED
    }

    public BigDecimal getEffectivePrice() {
        return salePrice != null && salePrice.compareTo(BigDecimal.ZERO) > 0 ? salePrice : basePrice;
    }
}
