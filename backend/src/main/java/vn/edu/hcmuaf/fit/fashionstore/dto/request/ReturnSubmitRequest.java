package vn.edu.hcmuaf.fit.fashionstore.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;
import vn.edu.hcmuaf.fit.fashionstore.entity.ReturnRequest;

import java.util.List;
import java.util.UUID;

@Getter
@Setter
public class ReturnSubmitRequest {
    @NotNull
    private UUID orderId;

    @NotNull
    private ReturnRequest.ReturnReason reason;

    private String note;

    @NotNull
    private ReturnRequest.ReturnResolution resolution;

    @NotEmpty
    private List<ReturnItemPayload> items;

    @Getter
    @Setter
    public static class ReturnItemPayload {
        @NotNull
        private UUID orderItemId;
        private Integer quantity;
        private String evidenceUrl;
        // Backward-compatible field used by older clients
        private String adminImageUrl;
    }
}
