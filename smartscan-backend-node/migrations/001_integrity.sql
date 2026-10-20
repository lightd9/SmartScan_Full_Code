ALTER TABLE auth
  DROP CONSTRAINT IF EXISTS auth_pkey,
  ADD CONSTRAINT auth_pkey PRIMARY KEY (id),
  ADD CONSTRAINT auth_role_check CHECK (role IN ('admin', 'manufacturer', 'supplier', 'retailer'));
CREATE UNIQUE INDEX IF NOT EXISTS auth_username_unique ON auth (username);

ALTER TABLE profile
  ADD CONSTRAINT profile_username_unique UNIQUE (username),
  ADD CONSTRAINT profile_username_fk FOREIGN KEY (username) REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT profile_role_check CHECK (role IS NULL OR role IN ('admin', 'manufacturer', 'supplier', 'retailer'));

ALTER TABLE product
  ADD COLUMN IF NOT EXISTS manufacturer_username varchar(50),
  ADD COLUMN IF NOT EXISTS chain_status varchar(20) NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS chain_tx_hash varchar(100),
  ADD COLUMN IF NOT EXISTS chain_id varchar(32),
  ADD COLUMN IF NOT EXISTS failure_reason varchar(500),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD CONSTRAINT product_chain_status_check CHECK (chain_status IN ('pending_chain', 'confirmed', 'failed'));
ALTER TABLE product
  ADD CONSTRAINT product_manufacturer_fk FOREIGN KEY (manufacturer_username) REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT;

