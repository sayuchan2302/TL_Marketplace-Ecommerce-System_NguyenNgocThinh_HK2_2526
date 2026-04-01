package vn.edu.hcmuaf.fit.fashionstore.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "return_requests", indexes = {
        @Index(name = "idx_return_requests_return_code", columnList = "return_code", unique = true),
        @Index(name = "idx_return_requests_status", columnList = "status"),
        @Index(name = "idx_return_requests_store_id", columnList = "store_id")
})
public class ReturnRequest extends BaseEntity {

    @Column(name = "return_code", length = 32, unique = true)
    private String returnCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "store_id")
    private UUID storeId;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ReturnReason reason;

    @Column(columnDefinition = "text")
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ReturnResolution resolution;

    @Enumerated(EnumType.STRING)
    @Column(length = 20)
    private ReturnStatus status = ReturnStatus.PENDING_VENDOR;

    @ElementCollection
    @CollectionTable(name = "return_items", joinColumns = @JoinColumn(name = "return_request_id"))
    private List<ReturnItemSnapshot> items = new ArrayList<>();

    @Column(name = "vendor_reason", columnDefinition = "text")
    private String vendorReason;

    @Column(name = "dispute_reason", columnDefinition = "text")
    private String disputeReason;

    @Column(name = "shipping_tracking_number")
    private String shippingTrackingNumber;

    @Column(name = "shipping_carrier")
    private String shippingCarrier;

    @Column(name = "shipped_at")
    private LocalDateTime shippedAt;

    @Column(name = "received_at")
    private LocalDateTime receivedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "admin_note", columnDefinition = "text")
    private String adminNote;

    @Column(name = "updated_by")
    private String updatedBy;

    public enum ReturnReason {
        SIZE, DEFECT, CHANGE, OTHER
    }

    public enum ReturnResolution {
        EXCHANGE, REFUND
    }

    public enum ReturnStatus {
        PENDING_VENDOR,
        ACCEPTED,
        SHIPPING,
        RECEIVED,
        COMPLETED,
        REJECTED,
        DISPUTED,
        CANCELLED
    }

    @Embeddable
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ReturnItemSnapshot {
        @Column(name = "order_item_id")
        private UUID orderItemId;

        @Column(name = "product_name")
        private String productName;

        @Column(name = "variant_name")
        private String variantName;

        @Column(name = "image_url")
        private String imageUrl;

        @Column(name = "evidence_url")
        private String evidenceUrl;

        @Column(name = "quantity")
        private Integer quantity;

        @Column(name = "unit_price")
        private BigDecimal unitPrice;
    }
}
