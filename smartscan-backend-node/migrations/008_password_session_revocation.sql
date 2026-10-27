ALTER TABLE auth
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auth_token_version_nonnegative_check'
      AND conrelid = 'auth'::regclass
  ) THEN
    ALTER TABLE auth
      ADD CONSTRAINT auth_token_version_nonnegative_check CHECK (token_version >= 0);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auth_password_events (
  id bigserial PRIMARY KEY,
  actor_username varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  target_username varchar(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE RESTRICT,
  event_type varchar(24) NOT NULL CHECK (event_type IN ('password_changed', 'password_reset')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_password_events_target_idx
  ON auth_password_events (target_username, created_at DESC, id);
