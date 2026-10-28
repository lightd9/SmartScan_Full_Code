-- A user may prove ownership of a wallet before the contract owner grants
-- its business role. Keep it visible in the account record, but non-authorized
-- until the audited on-chain operation completes.
ALTER TABLE auth DROP CONSTRAINT IF EXISTS auth_wallet_status_check;
ALTER TABLE auth ADD CONSTRAINT auth_wallet_status_check
  CHECK (wallet_status IN ('unlinked', 'pending_onchain', 'active', 'suspended', 'revoked'));

ALTER TABLE auth DROP CONSTRAINT IF EXISTS auth_wallet_state_check;
ALTER TABLE auth ADD CONSTRAINT auth_wallet_state_check
  CHECK (
    (wallet_status IN ('active', 'suspended', 'pending_onchain') AND wallet_address IS NOT NULL) OR
    (wallet_status IN ('unlinked', 'revoked') AND wallet_address IS NULL)
  );
