import { adminDb } from '../../lib/firebase/admin.js'
import {
  normalizeActionGrants,
  normalizeStringArray,
  type ActionGrants,
} from '../drive/governanceActions.js'

export const USERS_COLLECTION = 'users'
const FOLDERS_COLLECTION = 'folders'

export interface TargetUser {
  uid: string
  targetName: string
  role: string | undefined
  managedAreaIds: string[]
  memberAreaIds: string[]
  actionGrants: ActionGrants
}

export async function loadTargetUser(uid: string): Promise<TargetUser | null> {
  const snap = await adminDb().collection(USERS_COLLECTION).doc(uid).get()
  if (!snap.exists) return null

  const displayName = snap.get('displayName')
  const email = snap.get('email')
  const role = snap.get('role')

  return {
    uid,
    targetName:
      (typeof displayName === 'string' && displayName.trim()) ||
      (typeof email === 'string' && email.trim()) ||
      uid,
    role: typeof role === 'string' ? role : undefined,
    managedAreaIds: normalizeStringArray(snap.get('managedAreaIds')),
    memberAreaIds: normalizeStringArray(snap.get('memberAreaIds')),
    actionGrants: normalizeActionGrants(snap.get('actionGrants')),
  }
}

export async function validateAssignableAreaIds(areaIds: string[]): Promise<string[]> {
  const cleaned = normalizeStringArray(areaIds)
  if (cleaned.length === 0) return []

  const refs = cleaned.map((id) => adminDb().collection(FOLDERS_COLLECTION).doc(id))
  const snaps = await adminDb().getAll(...refs)
  const valid = new Set<string>()
  for (const snap of snaps) {
    if (!snap.exists) continue
    if (snap.get('legacy') === true) continue
    valid.add(snap.id)
  }

  const invalid = cleaned.filter((id) => !valid.has(id))
  if (invalid.length > 0) {
    throw new Error(`Área(s) inválida(s) o legacy: ${invalid.join(', ')}`)
  }

  return cleaned
}

export function parseReason(body: Record<string, unknown>, minReason: number): string | null {
  const reason = typeof body.reason === 'string' ? body.reason.trim() : ''
  if (reason.length < minReason) return null
  return reason
}
