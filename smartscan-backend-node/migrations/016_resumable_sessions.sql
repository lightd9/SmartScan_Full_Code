CREATE TABLE IF NOT EXISTS app_sessions (
  id uuid PRIMARY KEY,
  username varchar(50) NOT NULL REFERENCES auth(username) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  token_version integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS app_sessions_user_idx ON app_sessions(username);
