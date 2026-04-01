package vn.edu.hcmuaf.fit.fashionstore.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ReturnAdminVerdictRequest {

    @NotNull
    private VerdictAction action;

    private String adminNote;

    public enum VerdictAction {
        REFUND_TO_CUSTOMER,
        RELEASE_TO_VENDOR
    }
}
