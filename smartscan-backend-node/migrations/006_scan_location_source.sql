ALTER TABLE product_scans
  ADD COLUMN IF NOT EXISTS location_source varchar(32) NOT NULL DEFAULT 'legacy_unverified';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_scans_location_source_check'
  ) THEN
    ALTER TABLE product_scans
      ADD CONSTRAINT product_scans_location_source_check
      CHECK (location_source IN ('legacy_unverified', 'not_provided', 'browser_reported'));
  END IF;
END $$;
