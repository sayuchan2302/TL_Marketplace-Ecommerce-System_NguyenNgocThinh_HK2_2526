package vn.edu.hcmuaf.fit.fashionstore.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import lombok.experimental.SuperBuilder;

import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "customer_wallet_transactions", indexes = {
        @Index(name = "idx_customer_wallet_tx_code", columnList = "transaction_code", unique = true),
        @Index(name = "idx_customer_wallet_tx_return", columnList = "return_request_id")
})
public class CustomerWalletTransaction extends BaseEntity {

    @Column(name = "transaction_code", length = 32, unique = true)
    private String transactionCode;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "wallet_id", nullable = false)
    private CustomerWallet wallet;

    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "return_request_id")
    private UUID returnRequestId;

    @Column(name = "amount", nullable = false)
    private BigDecimal amount;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 30)
    private TransactionType type;

    @Column(name = "description")
    private String description;

    public enum TransactionType {
        CREDIT_REFUND
    }
}
