import test from 'node:test';
import assert from 'node:assert/strict';
import {
  expiredSessionCookieHeader,
  openSession,
  readSessionCookie,
  sealSession,
  sessionCookieHeader
} from './session-cookie.js';

const secret = 'test-only-session-secret-that-is-long-enough';

test('encrypted session payload round-trips without exposing its values', () => {
  const payload = {
    kind: 'google',
    appUserId: 'app-user-123',
    authUserId: 'auth-user-456',
    refreshToken: 'refresh-token-private'
  };
  const encoded = sealSession(payload, secret);
  assert.deepEqual(openSession(encoded, secret), payload);
  assert.equal(encoded.includes(payload.refreshToken), false);
});

test('tampered or wrongly keyed session cookies are rejected', () => {
  const encoded = sealSession({ kind: 'legacy', appUserId: 'app-user-123' }, secret);
  const [version, iv, tag, ciphertext] = encoded.split('.');
  const changedCiphertext = `${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`;
  const tampered = [version, iv, tag, changedCiphertext].join('.');
  assert.equal(openSession(tampered, secret), null);
  assert.equal(openSession(encoded, 'different-secret-that-is-also-long-enough'), null);
});

test('cookie helpers set HttpOnly, SameSite and Secure for HTTPS requests', () => {
  const req = { secure: true, get: name => name === 'host' ? 'shape.example.com' : undefined };
  const header = sessionCookieHeader(req, 'opaque-token');
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Lax/);
  assert.match(header, /Secure/);
  assert.equal(readSessionCookie(`other=1; ${header}`), 'opaque-token');
  assert.match(expiredSessionCookieHeader(req), /Max-Age=0/);
});
