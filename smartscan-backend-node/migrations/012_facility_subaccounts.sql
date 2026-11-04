-- 012_facility_subaccounts.sql
-- Enterprise encapsulated subaccounts with automated operational wallets and gas treasury logs.

CREATE TABLE IF NOT EXISTS facility_subaccounts (
    id SERIAL PRIMARY KEY,
    parent_username VARCHAR(50) NOT NULL REFERENCES auth(username) ON UPDATE CASCADE ON DELETE CASCADE,
    subaccount_name VARCHAR(120) NOT NULL,
    facility_code VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(32) NOT NULL CHECK (role IN ('manufacturer', 'supplier', 'retailer')),
    wallet_address VARCHAR(42) NOT NULL UNIQUE CHECK (wallet_address ~* '^0x[0-9a-f]{40}$'),
    encrypted_private_key TEXT NOT NULL,
    key_iv VARCHAR(32) NOT NULL,
    key_auth_tag VARCHAR(32) NOT NULL,
    key_version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_approval' CHECK (status IN ('pending_approval', 'active', 'suspended', 'revoked')),
    gas_balance_wei NUMERIC(78, 0) NOT NULL DEFAULT 0,
    last_funded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subaccounts_parent ON facility_subaccounts(parent_username);
CREATE INDEX IF NOT EXISTS idx_subaccounts_wallet ON facility_subaccounts(lower(wallet_address));
CREATE INDEX IF NOT EXISTS idx_subaccounts_status ON facility_subaccounts(status);

CREATE TABLE IF NOT EXISTS gas_treasury_disbursements (
    id SERIAL PRIMARY KEY,
    subaccount_id INTEGER REFERENCES facility_subaccounts(id) ON DELETE CASCADE,
    recipient_wallet VARCHAR(42) NOT NULL,
    amount_wei NUMERIC(78, 0) NOT NULL,
    tx_hash VARCHAR(100) NOT NULL UNIQUE,
    trigger_reason VARCHAR(64) NOT NULL,
    disbursed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_recipient ON gas_treasury_disbursements(lower(recipient_wallet));

