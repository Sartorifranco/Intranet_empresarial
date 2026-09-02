import { auth } from './firebase'

export interface ApplyPendingSetupResult {
  applied: boolean
  reason?: string
}

/** Idempotente: aplica pendingUserSetup/{email} vía backend (Admin SDK). */
export async function applyPendingUserSetupAfterRegister(): Promise<ApplyPendingSetupResult | null> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) return null

  const res = await fetch('/api/users/apply-pending-setup', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error ?? `Error ${res.status}`)
  }

  return (await res.json()) as ApplyPendingSetupResult
}
