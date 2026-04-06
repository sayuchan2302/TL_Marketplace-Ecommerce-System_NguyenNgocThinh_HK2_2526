package vn.edu.hcmuaf.fit.fashionstore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PublicStoreResponse {
    private UUID id;
    private String name;
    private String slug;
    private String description;
    private String logo;
    private String banner;
    private String contactEmail;
    private String phone;
    private String address;
    private String status;
    private String approvalStatus;
    private BigDecimal totalSales;
    private Integer totalOrders;
    private Double rating;
    private Integer productCount;
    private Integer liveProductCount;
    private Integer responseRate;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
