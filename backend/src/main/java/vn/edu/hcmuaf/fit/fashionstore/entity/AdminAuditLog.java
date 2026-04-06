package vn.edu.hcmuaf.fit.fashionstore.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
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
@Table(name = "admin_audit_logs", indexes = {
        @Index(name = "idx_admin_audit_created_at", columnList = "created_at"),
        @Index(name = "idx_admin_audit_actor_id", columnList = "actor_id"),
        @Index(name = "idx_admin_audit_domain", columnList = "domain"),
        @Index(name = "idx_admin_audit_target_id", columnList = "target_id")
})
public class AdminAuditLog extends BaseEntity {

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "actor_email")
    private String actorEmail;

    @Column(name = "domain", nullable = false, length = 50)
    private String domain;

    @Column(name = "action", nullable = false, length = 80)
    private String action;

    @Column(name = "target_id")
    private UUID targetId;

    @Column(name = "request_method", length = 10)
    private String requestMethod;

    @Column(name = "request_path")
    private String requestPath;

    @Column(name = "ip_address", length = 120)
    private String ipAddress;

    @Column(name = "user_agent", columnDefinition = "text")
    private String userAgent;

    @Column(name = "success", nullable = false)
    private boolean success;

    @Column(name = "note", columnDefinition = "text")
    private String note;
}
