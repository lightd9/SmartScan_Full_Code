const crypto = require('crypto');
const { ethers } = require('ethers');

const ALGORITHM = 'aes-256-gcm';

/**
 * Derives a 32-byte binary key from environment variables.
 * Uses OPERATIONAL_VAULT_SECRET if provided; otherwise derives deterministically from JWT_SECRET.
 */
function getMasterKey() {
  const secret = process.env.OPERATIONAL_VAULT_SECRET || process.env.JWT_SECRET || 'smartscan-default-secure-vault-key-32bytes!';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Generates an encapsulated operational EVM wallet and encrypts its private key via AES-256-GCM.
 * @returns {object} { walletAddress, encryptedPrivateKey, keyIv, keyAuthTag, keyVersion }
 */
function generateEncapsulatedSubaccount() {
  const wallet = ethers.Wallet.createRandom();
  const iv = crypto.randomBytes(16);
  const masterKey = getMasterKey();

  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);
  let encrypted = cipher.update(wallet.privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return {
    walletAddress: wallet.address,
    encryptedPrivateKey: encrypted,
    keyIv: iv.toString('hex'),
    keyAuthTag: authTag.toString('hex'),
    keyVersion: 1,
  };
}

/**
 * Decrypts an encrypted private key with authentication tag verification.
 * Throws an error if tampering is detected or the authentication tag does not match.
 * @param {object} params { encryptedPrivateKey, keyIv, keyAuthTag }
 * @returns {string} Plaintext private key
 */
function decryptSubaccountPrivateKey({ encryptedPrivateKey, keyIv, keyAuthTag }) {
  if (!encryptedPrivateKey || !keyIv || !keyAuthTag) {
    throw new Error('Incomplete keystore parameters for subaccount decryption');
  }

  const iv = Buffer.from(keyIv, 'hex');
  const authTag = Buffer.from(keyAuthTag, 'hex');
  const masterKey = getMasterKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedPrivateKey, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
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

