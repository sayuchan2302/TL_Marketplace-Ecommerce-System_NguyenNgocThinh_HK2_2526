CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_id UUID,
    actor_email VARCHAR(255),
    domain VARCHAR(50) NOT NULL,
    action VARCHAR(80) NOT NULL,
    target_id UUID,
    request_method VARCHAR(10),
    request_path VARCHAR(512),
    ip_address VARCHAR(120),
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    note TEXT
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created_at ON admin_audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor_id ON admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_domain ON admin_audit_logs(domain);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target_id ON admin_audit_logs(target_id);
