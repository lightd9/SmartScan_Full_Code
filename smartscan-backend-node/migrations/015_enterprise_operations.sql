-- Durable facility signing journal. Signed payloads are server-only and must
-- never be returned by an API. Persist before broadcasting, recover by hash.
ALTER TABLE product ADD COLUMN IF NOT EXISTS packaging_kind text NOT NULL DEFAULT 'carton'
  CHECK (packaging_kind IN ('carton', 'bottle'));
ALTER TABLE facility_subaccounts ADD COLUMN IF NOT EXISTS location text NOT NULL DEFAULT '';

CREATE TABLE enterprise_operations (
  id uuid PRIMARY KEY,
  username text NOT NULL REFERENCES auth(username),
  request_key uuid NOT NULL,
  request_fingerprint text NOT NULL,
  facility_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('register','receive','dispatch','sell','recall')),
  recipient_id text,
  reason text,
  location jsonb NOT NULL,
  token_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(username, request_key)
);
CREATE TABLE enterprise_operation_items (
  operation_id uuid NOT NULL REFERENCES enterprise_operations(id),
  serial_number text NOT NULL REFERENCES product(serialnumber),
  expected_version integer NOT NULL,
  position integer NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','submitted','confirmed','failed')),
  message text,
  transaction_hash text,
  signed_transaction text,
  signer_address text,
  transaction_nonce bigint,
  block_number bigint,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(operation_id, serial_number)
);
CREATE UNIQUE INDEX enterprise_one_pending_product ON enterprise_operation_items(serial_number)
  WHERE status IN ('queued','submitted');
CREATE INDEX enterprise_operations_account ON enterprise_operations(username, created_at DESC);
CREATE INDEX enterprise_operation_items_pending ON enterprise_operation_items(updated_at)
  WHERE status IN ('queued','submitted');
