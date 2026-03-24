package vn.edu.hcmuaf.fit.fashionstore.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductRequest {
    private String name;
    private String slug;
    private String description;
    private UUID categoryId;
    private Double basePrice;
    private Double salePrice;
    private String material;
    private String fit;
    private String gender;
}
