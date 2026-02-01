// Web Crypto API helpers for key derivation and management

// Constants
const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const KEY_LENGTH_BITS = 256;
const IV_LENGTH = 12;

/**
 * Generate a random salt for KEK derivation
 */
export function generateSalt(): string {
  if (typeof window === 'undefined') {
    // Basic fallback for server-side generation (though mostly client-side)
    // In a real edge case, use Node's crypto module, but this targets browser usage
    const arr = new Uint8Array(SALT_LENGTH);
    for(let i=0; i<SALT_LENGTH; i++) arr[i] = Math.floor(Math.random() * 256);
    return btoa(String.fromCharCode(...arr));
  }
  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return btoa(String.fromCharCode(...salt));
}

/**
 * Derive Key Encryption Key (KEK) from passphrase
 */
export async function deriveKEK(passphrase: string, saltBase64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits']
  );

  const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true, // Extractable so we can use it to unwrap DEK? Actually usually false for KEK but we might need it for consistent usage
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

/**
 * Generate a new random Data Encryption Key (DEK)
 */
export async function generateDEK(): Promise<CryptoKey> {
  return window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: KEY_LENGTH_BITS
    },
    true, // Extractable so we can export/import it
    ['encrypt', 'decrypt']
  );
}

/**
 * Serialize a CryptoKey to base64 raw format
 */
export async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey('raw', key);
  return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

/**
 * Import a CryptoKey from base64 raw format
 */
export async function importKey(keyBase64: string): Promise<CryptoKey> {
  const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
  return window.crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Wrap (encrypt) the DEK using the KEK
 */
export async function wrapDEK(dek: CryptoKey, kek: CryptoKey): Promise<string> {
  // We use AES-GCM to wrap the key
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  // First export DEK to raw bytes
  const dekBytes = await window.crypto.subtle.exportKey('raw', dek);
  
  // Encrypt raw bytes with KEK
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    kek,
    dekBytes
  );

  // Combine IV + Encrypted Data
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Unwrap (decrypt) the DEK using the KEK
 */
export async function unwrapDEK(wrappedDEKBase64: string, kek: CryptoKey): Promise<CryptoKey> {
  const combined = Uint8Array.from(atob(wrappedDEKBase64), c => c.charCodeAt(0));
  
  const iv = combined.slice(0, IV_LENGTH);
  const data = combined.slice(IV_LENGTH);

  const decryptedBytes = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    kek,
    data
  );

  return window.crypto.subtle.importKey(
    'raw',
    decryptedBytes,
    { name: 'AES-GCM', length: KEY_LENGTH_BITS },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Create a verification blob to test the KEK
 * Encrypts a known string "VERIFY" with the KEK
 */
export async function createVerificationBlob(kek: CryptoKey): Promise<string> {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const enc = new TextEncoder();
  const data = enc.encode('VERIFY');

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    kek,
    data
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Verify if the derived KEK is correct by trying to decrypt the blob
 */
export async function verifyKEK(kek: CryptoKey, verificationBlobBase64: string): Promise<boolean> {
  try {
    const combined = Uint8Array.from(atob(verificationBlobBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      kek,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decrypted) === 'VERIFY';
  } catch (e) {
    return false;
  }
}
