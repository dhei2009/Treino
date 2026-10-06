import crypto from 'node:crypto';

export const SESSION_COOKIE_NAME = 'st_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function encryptionKey(secret) {
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('SESSION_SECRET precisa ter pelo menos 16 caracteres.');
  }
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

export function sealSession(payload, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(secret), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);
  return [
    'v1',
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url')
  ].join('.');
}

export function openSession(value, secret) {
  if (typeof value !== 'string') return null;
  const [version, ivPart, tagPart, ciphertextPart, extra] = value.split('.');
  if (version !== 'v1' || !ivPart || !tagPart || !ciphertextPart || extra !== undefined) return null;

  try {
    const iv = Buffer.from(ivPart, 'base64url');
    const tag = Buffer.from(tagPart, 'base64url');
    const ciphertext = Buffer.from(ciphertextPart, 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(secret), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    const payload = JSON.parse(plaintext);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    if (!['google', 'legacy'].includes(payload.kind) || typeof payload.appUserId !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}

export function readSessionCookie(cookieHeader = '') {
  const prefix = `${SESSION_COOKIE_NAME}=`;
  const entry = String(cookieHeader).split(';').map(part => part.trim()).find(part => part.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : null;
}

function isSecureRequest(req) {
  const forwardedProtocol = String(req?.get?.('x-forwarded-proto') || '').split(',')[0].trim();
  const host = String(req?.get?.('host') || '').split(':')[0].toLowerCase();
  return req?.secure === true
    || req?.protocol === 'https'
    || forwardedProtocol === 'https';
}

export function sessionCookieHeader(req, value, maxAge = SESSION_MAX_AGE_SECONDS, forceSecure = false) {
  const secure = forceSecure || isSecureRequest(req) ? '; Secure' : '';
  return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAge))}${secure}`;
}

export function expiredSessionCookieHeader(req, forceSecure = false) {
  return sessionCookieHeader(req, '', 0, forceSecure);
}
