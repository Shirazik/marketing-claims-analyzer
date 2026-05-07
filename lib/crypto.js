/**
 * AES-GCM encryption for API key storage.
 * Key is derived via PBKDF2 from the user's stable Google account ID
 * (fetched via chrome.identity) so the decryption key is never written to disk.
 * Falls back to extension ID only if the user is not signed into Chrome.
 */

const PBKDF2_ITERATIONS = 100_000;

async function getKeyMaterial() {
  const extensionId = chrome.runtime.id;
  let userId = '';
  try {
    const profile = await chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' });
    userId = profile?.id || '';
  } catch {
    // identity API unavailable or user not signed into Chrome — use extension ID only
  }
  return new TextEncoder().encode(userId + extensionId);
}

async function deriveKey(keyMaterial, salt) {
  const base = await crypto.subtle.importKey('raw', keyMaterial, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptValue(plaintext) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(await getKeyMaterial(), salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  return {
    iv:         toBase64(iv),
    ciphertext: toBase64(ciphertext),
    salt:       toBase64(salt),
  };
}

export async function decryptValue({ iv, ciphertext, salt }) {
  const key = await deriveKey(await getKeyMaterial(), fromBase64(salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

function toBase64(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function fromBase64(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
