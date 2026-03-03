import crypto from 'crypto';

/**
 * Generates a cryptographically random 6-digit OTP.
 */
export function generateOtp(): string {
  const num = crypto.randomInt(100000, 999999);
  return num.toString();
}

/**
 * Creates a SHA-256 hash of the OTP with a salt.
 */
export function hashOtp(otp: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update(salt + otp).digest('hex');
  return salt + ':' + hash;
}

/**
 * Verifies an OTP against a stored hash.
 */
export function verifyOtp(otp: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;
  const computedHash = crypto.createHash('sha256').update(salt + otp).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computedHash, 'hex'));
}
