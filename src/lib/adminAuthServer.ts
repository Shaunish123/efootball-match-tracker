import crypto from 'crypto';

const getSecret = () => process.env.ADMIN_MASTER_KEY || '1234';

/**
 * Validates entered PIN against ADMIN_MASTER_KEY environment variable.
 */
export function verifyAdminPin(pin: string): boolean {
  if (!pin) return false;
  const masterKey = getSecret().trim();
  return pin.trim() === masterKey;
}

/**
 * Creates a signed admin token with timestamp and HMAC signature.
 */
export function createAdminToken(): string {
  const timestamp = Date.now();
  const data = `admin:${timestamp}`;
  const hmac = crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
  return Buffer.from(`${data}:${hmac}`).toString('base64');
}

/**
 * Validates a signed admin token or PIN.
 */
export function verifyAdminRequest(tokenOrPin?: string | null): boolean {
  if (!tokenOrPin) return false;

  // Direct PIN check
  if (verifyAdminPin(tokenOrPin)) return true;

  // Signed token check
  try {
    const decoded = Buffer.from(tokenOrPin, 'base64').toString('utf-8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return false;
    const [prefix, timeStr, hmac] = parts;
    if (prefix !== 'admin') return false;

    const timestamp = parseInt(timeStr, 10);
    // Token valid for 7 days (7 * 24 * 60 * 60 * 1000 ms)
    if (isNaN(timestamp) || Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
      return false;
    }

    const expectedHmac = crypto.createHmac('sha256', getSecret()).update(`admin:${timeStr}`).digest('hex');
    const hmacBuf = Buffer.from(hmac);
    const expectedBuf = Buffer.from(expectedHmac);

    if (hmacBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(hmacBuf, expectedBuf);
  } catch {
    return false;
  }
}
