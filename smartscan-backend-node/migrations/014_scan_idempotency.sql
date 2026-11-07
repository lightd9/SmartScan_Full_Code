-- Old clients remain compatible; only requests with an event ID can be replayed.
ALTER TABLE product_scans ADD COLUMN IF NOT EXISTS event_id uuid;
ALTER TABLE product_scans ADD COLUMN IF NOT EXISTS request_digest char(64);
ALTER TABLE product_scans ADD COLUMN IF NOT EXISTS scan_purpose varchar(24) NOT NULL DEFAULT 'unspecified';
CREATE UNIQUE INDEX IF NOT EXISTS product_scans_event_id_idx ON product_scans (event_id) WHERE event_id IS NOT NULL;
