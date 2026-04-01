package vn.edu.hcmuaf.fit.fashionstore.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AdminProductRejectRequest {

    @NotBlank(message = "reason is required")
    private String reason;
}
