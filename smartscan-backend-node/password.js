const crypto = require('crypto');

const SCRYPT_PREFIX = 'scrypt';
const KEY_LENGTH = 64;

function hashPassword(plain, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(String(plain), salt, KEY_LENGTH).toString('hex');
  return `${SCRYPT_PREFIX}$${salt}$${derived}`;
}

function isHashed(stored) {
  return typeof stored === 'string' && stored.startsWith(`${SCRYPT_PREFIX}$`);
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyPassword(plain, stored) {
  if (!isHashed(stored)) {
    return timingSafeEqualStr(plain, stored);
  }
  const [, salt, digest] = stored.split('$');
  if (!salt || !digest) {
    return false;
  }
  const derived = crypto.scryptSync(String(plain), salt, KEY_LENGTH).toString('hex');
  return timingSafeEqualStr(derived, digest);
}

module.exports = { hashPassword, isHashed, verifyPassword };
