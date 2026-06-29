import { deriveKEK, wrapDEK, generateDEK, createVerificationBlob, generateSalt, verifyKEK } from '../../crypto/keys';

/**
 * Client-side crypto setup helper
 * Returns the payload needed to initialize the user on the server
 */
export async function preparePassphraseSetup(passphrase: string) {
  const salt = generateSalt();
  const kek = await deriveKEK(passphrase, salt);
  const dek = await generateDEK();
  const wrappedDEK = await wrapDEK(dek, kek);
  const verificationBlob = await createVerificationBlob(kek);

  return {
    salt,
    wrappedDEK,
    verificationBlob,
    dek // Return the derived DEK for initial setup items
  };
}

/**
 * Verify passphrase and return DEK if correct
 */
export async function unlockVault(passphrase: string, salt: string, wrappedDEK: string, verificationBlob: string): Promise<CryptoKey | null> {
  try {
    const kek = await deriveKEK(passphrase, salt);
    const isValid = await verifyKEK(kek, verificationBlob);
    
    if (!isValid) return null;

    // Unwrap DEK
    // We need unwrapDEK from keys.ts which uses window.crypto
    // This file is client-side logic
    const { unwrapDEK } = await import('../../crypto/keys');
    return await unwrapDEK(wrappedDEK, kek);
  } catch (e) {
    console.error("Unlock failed", e);
    return null;
  }
}
