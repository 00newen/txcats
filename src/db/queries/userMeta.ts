import { db } from '..';
import { userMeta } from '../schema';
import { eq } from 'drizzle-orm';
import { UserMeta } from '../../types/database';

/**
 * Get user encryption metadata
 */
export async function getUserMeta(userId: string): Promise<UserMeta | undefined> {
  return db.query.userMeta.findFirst({
    where: eq(userMeta.userId, userId),
  });
}

/**
 * Create initial user encryption setup
 */
export async function createUserMeta(
  userId: string,
  userSaltBase64: string,
  wrappedDEKBase64: string,
  verificationBlobBase64: string
): Promise<UserMeta> {
  const [meta] = await db.insert(userMeta).values({
    userId,
    userSaltBase64,
    wrappedDEKBase64,
    verificationBlobBase64,
  }).returning();
  return meta;
}

/**
 * Update wrapped keys (e.g. changing passphrase)
 */
export async function updateUserMetaKeys(
  userId: string,
  userSaltBase64: string,
  wrappedDEKBase64: string,
  verificationBlobBase64: string
): Promise<UserMeta> {
  const [meta] = await db.update(userMeta)
    .set({
      userSaltBase64,
      wrappedDEKBase64,
      verificationBlobBase64,
      updatedAt: new Date(),
    })
    .where(eq(userMeta.userId, userId))
    .returning();
  return meta;
}
