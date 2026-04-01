package vn.edu.hcmuaf.fit.fashionstore.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReturnDisputeRequest {
    @NotBlank
    private String reason;
}
