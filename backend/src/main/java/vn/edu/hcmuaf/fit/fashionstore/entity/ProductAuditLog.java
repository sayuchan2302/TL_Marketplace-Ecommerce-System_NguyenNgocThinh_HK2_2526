package vn.edu.hcmuaf.fit.fashionstore.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.util.UUID;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "product_audit_logs", indexes = {
        @Index(name = "idx_product_audit_product_id", columnList = "product_id"),
        @Index(name = "idx_product_audit_admin_id", columnList = "admin_id")
})
public class ProductAuditLog extends BaseEntity {

    @Column(name = "product_id", nullable = false)
    private UUID productId;

    @Column(name = "admin_id")
    private UUID adminId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Action action;

    @Column(columnDefinition = "text")
    private String reason;

    public enum Action {
        APPROVED,
        BANNED,
        REJECTED,
        BULK_APPROVED
    }
}
