CREATE TABLE IF NOT EXISTS product_scans (
  id bigserial PRIMARY KEY,
  serial_number varchar(100) NOT NULL,
  contract_address varchar(42),
  visitor_hash char(64) NOT NULL,
  outcome varchar(16) NOT NULL CHECK (outcome IN ('valid', 'invalid')),
  latitude numeric(8,5),
  longitude numeric(8,5),
  flags text[] NOT NULL DEFAULT '{}',
  scanned_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);

CREATE INDEX IF NOT EXISTS product_scans_serial_time_idx ON product_scans (serial_number, scanned_at DESC);
CREATE INDEX IF NOT EXISTS product_scans_visitor_time_idx ON product_scans (visitor_hash, scanned_at DESC);
