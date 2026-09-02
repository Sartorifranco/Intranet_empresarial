import type { DocumentData } from 'firebase-admin/firestore'
import { adminDb } from '../../lib/firebase/admin.js'
import { getEnv, isEmailInAllowedDomain } from '../../config/env.js'

export type AreaMember = {
  uid: string
  email: string
  displayName: string | null
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function mapUserToMember(
  uid: string,
  data: DocumentData,
  domain: string,
): AreaMember | null {
  const emailRaw = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
  if (!emailRaw || !isEmailInAllowedDomain(emailRaw, domain)) return null
  const displayName =
    typeof data.displayName === 'string' && data.displayName.trim().length > 0
      ? data.displayName.trim()
      : null
  return { uid, email: emailRaw, displayName }
}

/** Miembros de un área: memberAreaIds ∪ managedAreaIds (jefes incluidos), sin duplicar. */
export async function resolveAreaMembers(areaId: string): Promise<AreaMember[]> {
  const domain = getEnv().allowedEmailDomain
  const db = adminDb()

  const [membersSnap, chiefsSnap] = await Promise.all([
    db.collection('users').where('memberAreaIds', 'array-contains', areaId).get(),
    db.collection('users').where('managedAreaIds', 'array-contains', areaId).get(),
  ])

  const byUid = new Map<string, AreaMember>()

  for (const snap of [...membersSnap.docs, ...chiefsSnap.docs]) {
    const row = mapUserToMember(snap.id, snap.data(), domain)
    if (row) byUid.set(row.uid, row)
  }

  return [...byUid.values()].sort((a, b) =>
    (a.displayName ?? a.email).localeCompare(b.displayName ?? b.email, 'es'),
  )
}

export async function getAreaDisplayName(areaId: string): Promise<string | null> {
  const snap = await adminDb().collection('folders').doc(areaId).get()
  if (!snap.exists) return null
  const name = snap.get('name')
  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : null
}

export function userHasAreaMembership(data: DocumentData, areaId: string): boolean {
  return (
    normalizeStringArray(data.memberAreaIds).includes(areaId) ||
    normalizeStringArray(data.managedAreaIds).includes(areaId)
  )
}
