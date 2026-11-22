/*
 * At-rest encryption for LockedIn, using only the browser's built-in WebCrypto.
 *
 *  - Key derivation: PBKDF2-SHA256, 600,000 iterations (OWASP 2023 guidance), 16-byte random salt.
 *  - Cipher: AES-256-GCM (authenticated: tampering is detected), fresh 12-byte IV per write.
 *  - The derived key is NON-extractable: page scripts can use it but can never read its bytes.
 */

export const KDF_ITERATIONS = 600_000;
const AAD = new TextEncoder().encode('lockedin/v1');

export interface Sealed {
  lockedin: 'sealed';
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iter: number;
  salt: string; // base64
  iv: string; // base64
  ct: string; // base64 ciphertext + GCM tag
}

export function randomBytes(n: number) {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function toB64(bytes: Uint8Array) {
  let s = '';
  // chunked so large payloads don't blow the call stack
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(b64: string) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(passcode: string, salt: Uint8Array, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(passcode.normalize('NFKC')), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // non-extractable
    ['encrypt', 'decrypt'],
  );
}

export async function seal(key: CryptoKey, salt: Uint8Array, iterations: number, plaintext: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD }, key, new TextEncoder().encode(plaintext)),
  );
  return { lockedin: 'sealed', v: 1, kdf: 'PBKDF2-SHA256', iter: iterations, salt: toB64(salt), iv: toB64(iv), ct: toB64(ct) };
}

/** Throws if the key is wrong or the data was tampered with. */
export async function unseal(key: CryptoKey, sealed: Sealed): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: AAD },
    key,
    fromB64(sealed.ct),
  );
  return new TextDecoder().decode(pt);
}

export function isSealed(x: unknown): x is Sealed {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o.lockedin === 'sealed' &&
    o.v === 1 &&
    o.kdf === 'PBKDF2-SHA256' &&
    typeof o.iter === 'number' &&
    o.iter >= 100_000 &&
    o.iter <= 10_000_000 &&
    typeof o.salt === 'string' &&
    typeof o.iv === 'string' &&
    typeof o.ct === 'string'
  );
}

export async function sealWithPassword(passcode: string, plaintext: string) {
  const salt = randomBytes(16);
  return seal(await deriveKey(passcode, salt), salt, KDF_ITERATIONS, plaintext);
}

export async function unsealWithPassword(passcode: string, sealed: Sealed) {
  return unseal(await deriveKey(passcode, fromB64(sealed.salt), sealed.iter), sealed);
}

/** Rough passcode strength, used to nudge users away from weak codes. */
export function passcodeStrength(p: string): { ok: boolean; label: string } {
  if (p.length < 6) return { ok: false, label: 'Too short: at least 6 characters' };
  if (/^(\d)\1+$/.test(p) || /^(012345|123456|234567|345678|456789|654321|987654|password|qwerty)/i.test(p))
    return { ok: false, label: 'Too easy to guess' };
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^a-zA-Z\d]/].filter((r) => r.test(p)).length;
  if (p.length >= 12 || (p.length >= 8 && classes >= 3)) return { ok: true, label: 'Strong 💪' };
  if (/^\d+$/.test(p)) return { ok: true, label: 'OK. A longer passphrase is much stronger.' };
  return { ok: true, label: 'Decent' };
}
