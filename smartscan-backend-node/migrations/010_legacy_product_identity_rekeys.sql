CREATE TABLE IF NOT EXISTS product_identity_rekey_events (
  id bigserial PRIMARY KEY,
  previous_serial_number varchar(100) NOT NULL UNIQUE,
  new_serial_number varchar(100) NOT NULL UNIQUE REFERENCES product(serialnumber) ON UPDATE CASCADE ON DELETE RESTRICT,
  actor_username varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  evidence_reference varchar(500) NOT NULL CHECK (length(btrim(evidence_reference)) >= 8),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (previous_serial_number <> new_serial_number)
);

CREATE INDEX IF NOT EXISTS product_identity_rekey_events_created_idx
  ON product_identity_rekey_events (created_at DESC, id DESC);
