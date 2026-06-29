import { auth } from '@clerk/nextjs/server'
import { getVaultsByUserId } from '@/db/queries/vaults'
import { fail, ok, type ActionResult } from '@/lib/actions/result'

export async function requirePrimaryVault(): Promise<ActionResult<{ userId: string; vaultId: string }>> {
  const { userId } = await auth()
  if (!userId) {
    return fail('UNAUTHORIZED', 'Unauthorized')
  }

  const vaults = await getVaultsByUserId(userId)
  if (!vaults || vaults.length === 0) {
    return fail('NO_VAULT', 'No vault found')
  }

  return ok({
    userId,
    vaultId: vaults[0].id,
  })
}
