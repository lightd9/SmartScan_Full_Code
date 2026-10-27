ALTER TABLE product DROP CONSTRAINT IF EXISTS product_chain_status_check;

UPDATE product
SET chain_status = CASE
  WHEN chain_status = 'pending_chain' AND chain_tx_hash ~ '^0x[0-9a-fA-F]{64}$' THEN 'submitted'
  WHEN chain_status = 'pending_chain' THEN 'needs_retry'
  ELSE chain_status
END;

ALTER TABLE product
  ADD CONSTRAINT product_chain_status_check CHECK (chain_status IN ('pending_wallet', 'submitted', 'confirmed', 'failed', 'needs_retry')),
  ADD COLUMN IF NOT EXISTS chain_sender varchar(42),
  ADD COLUMN IF NOT EXISTS chain_contract_address varchar(42),
  ADD COLUMN IF NOT EXISTS chain_expected_id varchar(32),
  ADD COLUMN IF NOT EXISTS chain_event_scan_block bigint,
  ADD COLUMN IF NOT EXISTS chain_reconciled_at timestamptz,
  ADD COLUMN IF NOT EXISTS chain_attempt integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS chain_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS chain_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS chain_description text,
  ADD COLUMN IF NOT EXISTS chain_image varchar(255),
  ADD COLUMN IF NOT EXISTS chain_actor varchar(100),
  ADD COLUMN IF NOT EXISTS chain_location text,
  ADD COLUMN IF NOT EXISTS chain_timestamp varchar(100);

UPDATE product SET chain_expected_id = chain_id, chain_id = NULL WHERE chain_status = 'submitted';

CREATE UNIQUE INDEX IF NOT EXISTS product_serialnumber_unique ON product (serialnumber);

CREATE TABLE IF NOT EXISTS product_chain_attempts (
  id bigserial PRIMARY KEY,
  serial_number varchar(100) NOT NULL REFERENCES product(serialnumber) ON UPDATE CASCADE ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  status varchar(20) NOT NULL CHECK (status IN ('pending_wallet', 'submitted', 'confirmed', 'failed', 'needs_retry')),
  transaction_hash varchar(66),
  chain_id varchar(32),
  expected_chain_id varchar(32),
  contract_address varchar(42),
  sender_address varchar(42),
  failure_reason varchar(500),
  recovered_from_chain boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  finalized_at timestamptz,
  UNIQUE (serial_number, attempt_number)
);

CREATE INDEX IF NOT EXISTS product_chain_attempt_tx_hash_idx
  ON product_chain_attempts (lower(transaction_hash)) WHERE transaction_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS product_chain_attempt_status_idx
  ON product_chain_attempts (status, created_at);

INSERT INTO product_chain_attempts (serial_number, attempt_number, status, transaction_hash, chain_id, expected_chain_id, contract_address, created_at, submitted_at)
SELECT serialnumber, 1, chain_status,
       CASE WHEN chain_tx_hash ~ '^0x[0-9a-fA-F]{64}$' THEN chain_tx_hash ELSE NULL END,
       NULL, chain_expected_id, NULL, created_at,
       CASE WHEN chain_tx_hash IS NOT NULL THEN created_at ELSE NULL END
FROM product
ON CONFLICT (serial_number, attempt_number) DO NOTHING;

CREATE INDEX IF NOT EXISTS product_chain_reconcile_idx ON product (chain_status, created_at);
