// Data encryption/decryption utilities

const IV_LENGTH = 12;

/**
 * Generate a random IV for data encryption
 */
export function generateIV(): string {
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  return btoa(String.fromCharCode(...iv));
}

/**
 * Create Additional Authenticated Data (AAD)
 * Binding ciphertext to vaultId and resourceType prevents moving encrypted blobs
 * between contexts (e.g. swapping a transaction to a different vault)
 */
export function createAAD(vaultId: string, resourceType: string): Uint8Array {
  const enc = new TextEncoder();
  return enc.encode(`${vaultId}:${resourceType}`);
}

/**
 * Encrypt arbitrary JSON data
 */
export async function encryptData(
  data: any,
  dek: CryptoKey,
  aad?: Uint8Array,
  existingIvanBase64?: string
): Promise<{ ciphertextBase64: string; ivBase64: string }> {
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));
  
  // Use existing IV if provided (for stable tests/updates if needed), otherwise generate new
  const iv = existingIvanBase64 
    ? Uint8Array.from(atob(existingIvanBase64), c => c.charCodeAt(0))
    : window.crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      additionalData: aad as unknown as BufferSource
    },
    dek,
    plaintext
  );

  return {
    ciphertextBase64: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    ivBase64: btoa(String.fromCharCode(...iv))
  };
}

/**
 * Decrypt data to JSON
 */
export async function decryptData<T>(
  ciphertextBase64: string,
  ivBase64: string,
  dek: CryptoKey,
  aad?: Uint8Array
): Promise<T> {
  const ciphertext = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      additionalData: aad as unknown as BufferSource
    },
    dek,
    ciphertext
  );

  const dec = new TextDecoder();
  const jsonString = dec.decode(decrypted);
  return JSON.parse(jsonString) as T;
}
