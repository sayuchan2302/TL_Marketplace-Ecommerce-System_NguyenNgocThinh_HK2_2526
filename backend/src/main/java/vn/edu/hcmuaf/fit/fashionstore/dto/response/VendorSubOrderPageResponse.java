package vn.edu.hcmuaf.fit.fashionstore.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class VendorSubOrderPageResponse {
    private List<SubOrderSummaryDto> content;
    private long totalElements;
    private int totalPages;
    private int number;
    private int size;
    private StatusCounts statusCounts;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StatusCounts {
        private long all;
        private long pending;
        private long confirmed;
        private long processing;
        private long shipped;
        private long delivered;
        private long cancelled;
    }
}
