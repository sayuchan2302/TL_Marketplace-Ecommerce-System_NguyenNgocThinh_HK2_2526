-- Support per-return refund debit idempotency and remove order-level uniqueness bottleneck.

ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS return_request_id UUID;

ALTER TABLE wallet_transactions
    DROP CONSTRAINT IF EXISTS uq_wallet_tx_order_type;

ALTER TABLE wallet_transactions
    DROP CONSTRAINT IF EXISTS uq_wallet_tx_return_type;

ALTER TABLE wallet_transactions
    ADD CONSTRAINT uq_wallet_tx_return_type
    UNIQUE (return_request_id, type);

CREATE INDEX IF NOT EXISTS idx_wallet_tx_return_request
    ON wallet_transactions(return_request_id);

ALTER TABLE wallet_transactions
    DROP CONSTRAINT IF EXISTS wallet_transactions_type_check;

ALTER TABLE wallet_transactions
    ADD CONSTRAINT wallet_transactions_type_check
    CHECK (
        type IN (
            'CREDIT',
            'DEBIT',
            'WITHDRAWAL',
            'ESCROW_CREDIT',
            'ESCROW_RELEASE',
            'PAYOUT_DEBIT',
            'REFUND_DEBIT',
            'RETURN_REFUND_DEBIT'
        )
    );
