ALTER TABLE auth
  ADD COLUMN IF NOT EXISTS wallet_address varchar(42),
  ADD COLUMN IF NOT EXISTS wallet_status varchar(16) NOT NULL DEFAULT 'unlinked';

ALTER TABLE auth
  ADD CONSTRAINT auth_wallet_status_check
  CHECK (wallet_status IN ('unlinked', 'active', 'suspended', 'revoked')),
  ADD CONSTRAINT auth_wallet_address_check
  CHECK (wallet_address IS NULL OR wallet_address ~* '^0x[0-9a-f]{40}$'),
  ADD CONSTRAINT auth_wallet_state_check
  CHECK ((wallet_status IN ('active', 'suspended') AND wallet_address IS NOT NULL) OR
         (wallet_status IN ('unlinked', 'revoked') AND wallet_address IS NULL));

CREATE UNIQUE INDEX IF NOT EXISTS auth_wallet_address_unique
  ON auth (lower(wallet_address))
  WHERE wallet_address IS NOT NULL;

CREATE TABLE IF NOT EXISTS wallet_link_challenges (
  id uuid PRIMARY KEY,
  username varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE CASCADE,
  operation_id uuid,
  wallet_address varchar(42) NOT NULL,
  message text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_link_challenges_username_idx
  ON wallet_link_challenges (username, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_account_events (
  id bigserial PRIMARY KEY,
  username varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  wallet_address varchar(42) NOT NULL,
  event_type varchar(32) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_account_events_username_idx
  ON wallet_account_events (username, created_at DESC, id);

CREATE TABLE IF NOT EXISTS wallet_operations (
  id uuid PRIMARY KEY,
  username varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  action varchar(16) NOT NULL CHECK (action IN ('link', 'replace', 'suspend', 'revoke', 'restore')),
  old_wallet_address varchar(42),
  new_wallet_address varchar(42),
  role varchar(20) NOT NULL,
  business_name varchar(100) NOT NULL,
  requested_by varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  status varchar(24) NOT NULL CHECK (status IN ('pending_wallet_proof', 'ready_onchain', 'completed', 'cancelled')),
  tx_hash varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE wallet_link_challenges
  ADD CONSTRAINT wallet_link_challenges_operation_fk
  FOREIGN KEY (operation_id) REFERENCES wallet_operations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS wallet_operations_status_created_idx
  ON wallet_operations (status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_operations_one_open_per_user_idx
  ON wallet_operations (username)
  WHERE status IN ('pending_wallet_proof', 'ready_onchain');

CREATE TABLE IF NOT EXISTS wallet_operation_events (
  id bigserial PRIMARY KEY,
  operation_id uuid NOT NULL REFERENCES wallet_operations(id) ON DELETE RESTRICT,
  actor_username varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  event_type varchar(32) NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_operation_events_operation_idx
  ON wallet_operation_events (operation_id, created_at, id);
