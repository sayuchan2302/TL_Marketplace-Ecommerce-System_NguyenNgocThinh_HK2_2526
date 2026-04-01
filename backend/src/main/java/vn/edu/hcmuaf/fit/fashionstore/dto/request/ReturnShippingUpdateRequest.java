package vn.edu.hcmuaf.fit.fashionstore.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReturnShippingUpdateRequest {
    @NotBlank
    private String trackingNumber;
    @NotBlank
    private String carrier;
}
