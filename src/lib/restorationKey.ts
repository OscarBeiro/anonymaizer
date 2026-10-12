import { validateSnapshot, type MappingSnapshot } from '../core/roundTrip';
const hex = (bytes: Uint8Array): string => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const unhex = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(s.match(/../g) ?? [], x => parseInt(x, 16));
const encoding = new TextEncoder();
interface Envelope { version: 1; algorithm: 'AES-256-GCM'; kdf: 'PBKDF2-HMAC-SHA256'; iterations: number; salt: string; nonce: string; ciphertext: string }
const aad = (e: Envelope) => encoding.encode(JSON.stringify([e.version, e.algorithm, e.kdf, e.iterations, e.salt, e.nonce]));
const key = async (password: string, e: Envelope): Promise<CryptoKey> => {
  if (!globalThis.crypto?.subtle) throw new Error('This browser cannot encrypt restoration keys. Use a supported browser on HTTPS, localhost or a supported file page.');
  if (!password || password.length > 1024) throw new Error('Enter a password of 1–1024 characters.');
  const material = await crypto.subtle.importKey('raw', encoding.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: unhex(e.salt), iterations: e.iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};
export const encryptRestorationKey = async (snapshot: MappingSnapshot, password: string): Promise<string> => {
  const payload = encoding.encode(JSON.stringify(validateSnapshot(snapshot)));
  if (payload.length > 4_000_000) throw new Error('Restoration key payload is too large.');
  const e: Envelope = { version: 1, algorithm: 'AES-256-GCM', kdf: 'PBKDF2-HMAC-SHA256', iterations: 600000, salt: hex(crypto.getRandomValues(new Uint8Array(16))), nonce: hex(crypto.getRandomValues(new Uint8Array(12))), ciphertext: '' };
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: unhex(e.nonce), additionalData: aad(e), tagLength: 128 }, await key(password, e), payload);
  e.ciphertext = hex(new Uint8Array(encrypted));
  return JSON.stringify(e);
};
export const decryptRestorationKey = async (file: string, password: string): Promise<MappingSnapshot> => {
  if (file.length > 8_010_000) throw new Error('Restoration key file is too large.');
  let e: Envelope;
  try { e = JSON.parse(file) as Envelope; } catch { throw new Error('Malformed restoration key.'); }
  if (!e || typeof e !== 'object' || e.version !== 1 || e.algorithm !== 'AES-256-GCM' || e.kdf !== 'PBKDF2-HMAC-SHA256') throw new Error('Unsupported restoration key format.');
  if (Object.keys(e).sort().join(',') !== 'algorithm,ciphertext,iterations,kdf,nonce,salt,version' ||
    !Number.isInteger(e.iterations) || e.iterations < 600000 || e.iterations > 1000000 ||
    typeof e.salt !== 'string' || !/^[a-f0-9]{32}$/.test(e.salt) || typeof e.nonce !== 'string' || !/^[a-f0-9]{24}$/.test(e.nonce) ||
    typeof e.ciphertext !== 'string' || e.ciphertext.length < 32 || e.ciphertext.length > 8_000_032 || !/^(?:[a-f0-9]{2})+$/.test(e.ciphertext)) throw new Error('Malformed restoration key parameters.');
  const derived = await key(password, e);
  let decrypted: ArrayBuffer;
  try { decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(e.nonce), additionalData: aad(e), tagLength: 128 }, derived, unhex(e.ciphertext)); }
  catch { throw new Error('Could not unlock the key: incorrect password or damaged file.'); }
  try { return validateSnapshot(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decrypted))); }
  catch { throw new Error('Invalid restoration key payload.'); }
};
export const newScope = (): string => hex(crypto.getRandomValues(new Uint8Array(16))).toUpperCase();
