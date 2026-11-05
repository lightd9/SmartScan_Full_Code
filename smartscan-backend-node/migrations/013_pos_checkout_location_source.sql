ALTER TABLE product_scans
  DROP CONSTRAINT IF EXISTS product_scans_location_source_check;

ALTER TABLE product_scans
  ADD CONSTRAINT product_scans_location_source_check
  CHECK (location_source IN ('legacy_unverified', 'not_provided', 'browser_reported', 'pos_checkout'));
