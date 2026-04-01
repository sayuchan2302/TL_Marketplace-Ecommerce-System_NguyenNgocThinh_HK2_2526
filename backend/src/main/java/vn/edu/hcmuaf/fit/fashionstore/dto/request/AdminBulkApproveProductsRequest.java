package vn.edu.hcmuaf.fit.fashionstore.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class AdminBulkApproveProductsRequest {

    @NotEmpty(message = "productIds must not be empty")
    private List<UUID> productIds;
}
