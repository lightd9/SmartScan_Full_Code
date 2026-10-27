CREATE TABLE IF NOT EXISTS product_manufacturer_assignment_events (
  id bigserial PRIMARY KEY,
  serial_number varchar(64) NOT NULL REFERENCES product(serialnumber) ON UPDATE CASCADE ON DELETE RESTRICT,
  previous_manufacturer_username varchar(50) REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  new_manufacturer_username varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  actor_username varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  evidence_reference varchar(500) NOT NULL CHECK (length(btrim(evidence_reference)) >= 8),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_manufacturer_assignment_events_created_idx
  ON product_manufacturer_assignment_events (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS product_manufacturer_assignment_events_serial_idx
  ON product_manufacturer_assignment_events (serial_number, created_at DESC, id DESC);
