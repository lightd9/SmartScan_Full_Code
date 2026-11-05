const crypto = require('crypto');
const { ethers } = require('ethers');

const ALGORITHM = 'aes-256-gcm';

function deriveMasterKey(secret) {
  return crypto.createHash('sha256').update(String(secret)).digest();
}

function getMasterKeyForVersion(keyVersion) {
  if (keyVersion === 2) {
    const secret = process.env.OPERATIONAL_VAULT_SECRET;
    if (!secret) throw new Error('OPERATIONAL_VAULT_SECRET is required to decrypt version 2 facility wallets.');
    return [deriveMasterKey(secret)];
  }
  if (keyVersion === 1) {
    // Version 1 was written before key_version distinguished vault-key rotations.
    // Try each legacy source used by prior releases without weakening new writes.
    const secrets = [
      process.env.LEGACY_VAULT_SECRET,
      process.env.OPERATIONAL_VAULT_SECRET,
      process.env.JWT_SECRET,
      'smartscan-default-secure-vault-key-32bytes!',
      'smartscan-local-vault-only',
    ].filter(Boolean);
    return [...new Set(secrets)].map(deriveMasterKey);
  }
  throw new Error(`Unsupported facility wallet key version: ${keyVersion}`);
}

function getNewMasterKey() {
  const secret = process.env.OPERATIONAL_VAULT_SECRET;
  if (secret) return { masterKey: deriveMasterKey(secret), keyVersion: 2 };
  if (process.env.NODE_ENV === 'production') {
    throw new Error('OPERATIONAL_VAULT_SECRET must be configured in production.');
  }
  return {
    masterKey: deriveMasterKey(process.env.JWT_SECRET || 'smartscan-default-secure-vault-key-32bytes!'),
    keyVersion: 1,
  };
}

/**
 * Generates an encapsulated operational EVM wallet and encrypts its private key via AES-256-GCM.
 * @returns {object} { walletAddress, encryptedPrivateKey, keyIv, keyAuthTag, keyVersion }
 */
function generateEncapsulatedSubaccount() {
  const wallet = ethers.Wallet.createRandom();
  const iv = crypto.randomBytes(16);
  const { masterKey, keyVersion } = getNewMasterKey();

  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  let encrypted = cipher.update(wallet.privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    walletAddress: wallet.address,
    encryptedPrivateKey: encrypted,
    keyIv: iv.toString('hex'),
    keyAuthTag: authTag.toString('hex'),
    keyVersion,
  };
}

/**
 * Decrypts an encrypted private key with authentication tag verification.
 * Throws an error if tampering is detected or the authentication tag does not match.
 * @param {object} params { encryptedPrivateKey, keyIv, keyAuthTag }
 * @returns {string} Plaintext private key
 */
function decryptSubaccountPrivateKey({ encryptedPrivateKey, keyIv, keyAuthTag, keyVersion, key_version }) {
  if (!encryptedPrivateKey || !keyIv || !keyAuthTag) {
    throw new Error('Incomplete keystore parameters for subaccount decryption');
  }

  const iv = Buffer.from(keyIv, 'hex');
  const authTag = Buffer.from(keyAuthTag, 'hex');
  const parsedVersion = Number(keyVersion ?? key_version ?? 1);
  const masterKeys = getMasterKeyForVersion(parsedVersion);
  for (const masterKey of masterKeys) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
      decipher.setAuthTag(authTag);
      return decipher.update(encryptedPrivateKey, 'hex', 'utf8') + decipher.final('utf8');
    } catch (_error) {
      // Keep trying legacy version 1 sources; GCM rejects a key that does not match.
    }
  }
  throw new Error(`Unable to decrypt facility wallet key version ${parsedVersion}.`);
}

/**
 * Decrypts subaccount key and returns an operational Ethers Signer ready to execute transactions.
 * @param {object} subaccountRecord { encryptedPrivateKey, keyIv, keyAuthTag, walletAddress }
 * @param {ethers.Provider} provider Optional JsonRpcProvider
 * @returns {ethers.Wallet}
 */
function getSubaccountSigner(subaccountRecord, provider = null) {
  const privateKey = decryptSubaccountPrivateKey(subaccountRecord);
  const wallet = new ethers.Wallet(privateKey, provider);
  if (wallet.address.toLowerCase() !== subaccountRecord.walletAddress.toLowerCase()) {
    throw new Error('Integrity error: Decrypted wallet address does not match recorded subaccount address');
  }
  return wallet;
}

module.exports = {
  generateEncapsulatedSubaccount,
  decryptSubaccountPrivateKey,
  getSubaccountSigner,
};

