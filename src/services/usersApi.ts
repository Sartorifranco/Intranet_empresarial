import { auth } from './firebase'

export interface ApplyPendingSetupResult {
  applied: boolean
  reason?: string
}

export type GovernanceAction =
  | 'approval'
  | 'permission_grant'
  | 'classification_change'
  | 'authorized_copy'

export type ActionGrants = Partial<Record<GovernanceAction, string[]>>

async function authFetch(path: string, init: RequestInit): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) {
    throw new Error('No autenticado')
  }

  return fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

async function parseError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => ({}))) as { error?: string }
  return body.error ?? `Error ${res.status}`
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

/** Grant/revoke puntual de excepción de gobernanza (solo super_admin). */
export async function patchUserActionGrants(
  uid: string,
  input: {
    action: GovernanceAction
    areaId: string
    operation: 'grant' | 'revoke'
    reason: string
  },
): Promise<{ actionGrants: ActionGrants }> {
  const res = await authFetch(`/api/users/${encodeURIComponent(uid)}/action-grants`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await parseError(res))
  return (await res.json()) as { actionGrants: ActionGrants }
}
