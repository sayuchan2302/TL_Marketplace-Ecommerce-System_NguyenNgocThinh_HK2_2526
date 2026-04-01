package vn.edu.hcmuaf.fit.fashionstore.dto.response;

import lombok.Builder;
import lombok.Data;
import vn.edu.hcmuaf.fit.fashionstore.entity.Product;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class AdminProductModerationResponse {
    private UUID id;
    private String productCode;
    private String name;
    private String thumbnail;
    private UUID storeId;
    private String storeName;
    private UUID categoryId;
    private String categoryName;
    private BigDecimal price;
    private Long sales;
    private Integer stock;
    private Product.ProductStatus productStatus;
    private Product.ApprovalStatus approvalStatus;
    private String description;
    private List<String> images;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
