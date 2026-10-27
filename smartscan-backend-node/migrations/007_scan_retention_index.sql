-- Supports bounded, ordered deletion of expired scan telemetry in batches.
CREATE INDEX IF NOT EXISTS product_scans_retention_idx
  ON product_scans (scanned_at, id);
