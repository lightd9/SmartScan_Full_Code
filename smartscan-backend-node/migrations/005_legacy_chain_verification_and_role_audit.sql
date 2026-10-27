-- Legacy `confirmed` values were written by the application before chain
-- receipts were independently verified. Treat them as claims until the
-- reconciler verifies the transaction or discovers the registration event.
ALTER TABLE product ALTER COLUMN chain_status SET DEFAULT 'pending_wallet';

UPDATE product
SET chain_status = CASE
      WHEN chain_tx_hash ~ '^0x[0-9a-fA-F]{64}$' THEN 'submitted'
      ELSE 'needs_retry'
    END,
    chain_expected_id = CASE
      WHEN chain_tx_hash ~ '^0x[0-9a-fA-F]{64}$' THEN COALESCE(chain_expected_id, chain_id)
      ELSE chain_expected_id
    END,
    chain_id = CASE WHEN chain_tx_hash ~ '^0x[0-9a-fA-F]{64}$' THEN NULL ELSE chain_id END,
    failure_reason = CASE
      WHEN chain_tx_hash ~ '^0x[0-9a-fA-F]{64}$'
        THEN 'Legacy confirmation was not receipt-verified; awaiting reconciliation.'
      ELSE 'Legacy confirmation has no valid transaction hash; awaiting event recovery or manual review.'
    END,
    chain_reconciled_at = NULL,
    chain_updated_at = now()
WHERE chain_status = 'confirmed';

UPDATE product_chain_attempts AS attempt
SET status = product.chain_status,
    chain_id = product.chain_id,
    expected_chain_id = product.chain_expected_id,
    failure_reason = product.failure_reason,
    finalized_at = NULL
FROM product
WHERE attempt.serial_number = product.serialnumber
  AND attempt.attempt_number = product.chain_attempt
  AND attempt.status = 'confirmed'
  AND product.chain_status IN ('submitted', 'needs_retry');

CREATE TABLE IF NOT EXISTS contract_role_audit (
  id bigserial PRIMARY KEY,
  action varchar(16) NOT NULL CHECK (action IN ('grant', 'revoke', 'ownership_transfer')),
  role_name varchar(20) NOT NULL CHECK (role_name IN ('admin', 'manufacturer', 'supplier', 'retailer')),
  wallet_address varchar(42) NOT NULL CHECK (wallet_address ~* '^0x[0-9a-f]{40}$'),
  actor_address varchar(42) CHECK (actor_address IS NULL OR actor_address ~* '^0x[0-9a-f]{40}$'),
  requested_by varchar(50) REFERENCES auth(username) ON UPDATE CASCADE ON DELETE SET NULL,
  chain_id varchar(32) NOT NULL CHECK (chain_id ~ '^[0-9]+$'),
  contract_address varchar(42) NOT NULL CHECK (contract_address ~* '^0x[0-9a-f]{40}$'),
  transaction_hash varchar(66) CHECK (transaction_hash IS NULL OR transaction_hash ~* '^0x[0-9a-f]{64}$'),
  status varchar(16) NOT NULL CHECK (status IN ('submitted', 'confirmed', 'failed')),
  receipt jsonb,
  failure_reason varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'submitted' AND transaction_hash IS NOT NULL AND receipt IS NULL) OR
         (status = 'confirmed' AND transaction_hash IS NOT NULL AND receipt IS NOT NULL) OR
         status = 'failed')
);

CREATE UNIQUE INDEX IF NOT EXISTS contract_role_audit_chain_tx_unique
  ON contract_role_audit (chain_id, lower(transaction_hash))
  WHERE transaction_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS contract_role_audit_created_idx
  ON contract_role_audit (created_at DESC, id DESC);
