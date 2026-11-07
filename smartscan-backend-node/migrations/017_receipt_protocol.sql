ALTER TABLE product ADD COLUMN IF NOT EXISTS chain_protocol text NOT NULL DEFAULT 'v2'
  CHECK (chain_protocol IN ('v2','receipt-v3'));

CREATE OR REPLACE FUNCTION preserve_product_authority() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.chain_contract_address IS NOT NULL AND (
    NEW.chain_protocol IS DISTINCT FROM OLD.chain_protocol OR
    lower(NEW.chain_contract_address) IS DISTINCT FROM lower(OLD.chain_contract_address) OR
    NEW.chain_expected_id IS DISTINCT FROM OLD.chain_expected_id
  ) THEN RAISE EXCEPTION 'Product authority is immutable; an explicit migration is required'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER product_authority_immutable BEFORE UPDATE ON product FOR EACH ROW EXECUTE FUNCTION preserve_product_authority();

CREATE TABLE handover_requests (
  id uuid PRIMARY KEY,
  serial_number text NOT NULL REFERENCES product(serialnumber),
  expected_version integer NOT NULL,
  sender_id bigint NOT NULL REFERENCES facility_subaccounts(id),
  receiver_id bigint NOT NULL REFERENCES facility_subaccounts(id),
  request_key uuid NOT NULL,
  requested_by text NOT NULL REFERENCES auth(username),
  status text NOT NULL DEFAULT 'requested' CHECK(status IN ('requested','approved','rejected','cancelled','submitted','received','expired')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  approved_by text REFERENCES auth(username),
  approval_token_version integer,
  expires_at timestamptz,
  dispatch_recorded boolean NOT NULL DEFAULT false,
  permit jsonb,
  signature text,
  operation_id uuid REFERENCES enterprise_operations(id),
  UNIQUE(requested_by,request_key,serial_number),
  CHECK(sender_id <> receiver_id)
);
CREATE UNIQUE INDEX one_approved_receiver ON handover_requests(serial_number,expected_version) WHERE status IN ('approved','submitted');
CREATE UNIQUE INDEX one_pending_receiver_request ON handover_requests(serial_number,expected_version,receiver_id) WHERE status='requested';
ALTER TABLE enterprise_operation_items ADD COLUMN IF NOT EXISTS proof_kind text NOT NULL DEFAULT 'blockchain' CHECK(proof_kind IN ('blockchain','offchain'));
ALTER TABLE enterprise_operation_items ADD COLUMN IF NOT EXISTS block_hash text;
ALTER TABLE enterprise_operation_items DROP CONSTRAINT enterprise_operation_items_status_check;
ALTER TABLE enterprise_operation_items ADD CONSTRAINT enterprise_operation_items_status_check CHECK(status IN ('waiting_approval','queued','submitted','confirmed','failed'));
