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
public class CategoryRequest {
    private String name;
    private String slug;
    private String description;
    private String image;
    private UUID parentId;
    private Integer sortOrder;
}
