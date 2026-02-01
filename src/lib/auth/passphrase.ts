import { deriveKEK, wrapDEK, generateDEK, createVerificationBlob, generateSalt, verifyKEK } from '../../crypto/keys';
import { createUserMeta } from '../../db/queries/userMeta';
import { createVault } from '../../db/queries/vaults';

/**
 * First-time passphrase setup
 * 1. Generate salt
 * 2. Derive KEK from passphrase + salt
 * 3. Generate new DEK
 * 4. Wrap DEK with KEK
 * 5. Create verification blob
 * 6. Save meta to DB
 * 7. Create default vault
 */
export async function setupPassphrase(userId: string, passphrase: string): Promise<void> {
  // 1. Generate salt
  const salt = generateSalt();

  // 2. Derive KEK
  const kek = await deriveKEK(passphrase, salt);

  // 3. Generate DEK
  const dek = await generateDEK();

  // 4. Wrap DEK
  const wrappedDEK = await wrapDEK(dek, kek);

  // 5. Verification blob
  const verificationBlob = await createVerificationBlob(kek);

  // 6. Save to DB (UserMeta)
  // Note: calls server action usually, but here we assume this runs in a client context communicating with server actions
  // Wait, these DB queries are server-side. We need a Server Action to bridge this.
  // We'll return the payload for the server action here.
  
  throw new Error("This function should be implemented as a Server Action or composed of client-side crypto + server action");
}

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
