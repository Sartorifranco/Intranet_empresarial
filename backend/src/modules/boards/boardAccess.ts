import { FieldValue, Timestamp, type Timestamp as FirestoreTimestamp } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '../../lib/firebase/admin.js'
import { getEnv, isEmailInAllowedDomain } from '../../config/env.js'
import { logError } from '../../lib/log.js'
import type { AuthedUser } from '../auth/middleware.js'
import { isSuperAdminUser as checkSuperAdmin } from '../auth/middleware.js'

export const BOARD_ACCESS_COLLECTION = 'boardAccess'

export interface BoardAccessGrantee {
  uid: string
  email: string
  displayName: string
  grantedAt: FirestoreTimestamp
  grantedBy: { uid: string; email: string }
}

export interface BoardAccessRecord {
  boardFolderId: string
  boardName: string
  allowedUsers: BoardAccessGrantee[]
  allowedUserIds: string[]
}

function granteeFromFirestore(raw: unknown): BoardAccessGrantee | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const row = raw as Record<string, unknown>
  const uid = typeof row.uid === 'string' ? row.uid : ''
  const email = typeof row.email === 'string' ? row.email.trim().toLowerCase() : ''
  if (!uid || !email) return null
  const grantedByRaw = row.grantedBy
  const grantedBy =
    grantedByRaw && typeof grantedByRaw === 'object' && !Array.isArray(grantedByRaw)
      ? {
          uid: typeof (grantedByRaw as Record<string, unknown>).uid === 'string'
            ? ((grantedByRaw as Record<string, unknown>).uid as string)
            : '',
          email: typeof (grantedByRaw as Record<string, unknown>).email === 'string'
            ? ((grantedByRaw as Record<string, unknown>).email as string).trim().toLowerCase()
            : '',
        }
      : { uid: '', email: '' }
  const displayName =
    typeof row.displayName === 'string' && row.displayName.trim()
      ? row.displayName.trim()
      : email
  if (!row.grantedAt || typeof row.grantedAt !== 'object') return null
  return {
    uid,
    email,
    displayName,
    grantedAt: row.grantedAt as FirestoreTimestamp,
    grantedBy,
  }
}

export function isSuperAdminUser(user: AuthedUser | undefined): boolean {
  return user ? checkSuperAdmin(user) : false
}

export async function getBoardAccessRecord(
  boardFolderId: string,
): Promise<BoardAccessRecord | null> {
  const snap = await adminDb().collection(BOARD_ACCESS_COLLECTION).doc(boardFolderId).get()
  if (!snap.exists) return null

  const allowedRaw = snap.get('allowedUsers')
  const allowedUsers = Array.isArray(allowedRaw)
    ? allowedRaw.map(granteeFromFirestore).filter((row): row is BoardAccessGrantee => row !== null)
    : []
  const allowedUserIdsRaw = snap.get('allowedUserIds')
  const allowedUserIds = Array.isArray(allowedUserIdsRaw)
    ? allowedUserIdsRaw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : allowedUsers.map((row) => row.uid)

  return {
    boardFolderId,
    boardName: typeof snap.get('boardName') === 'string' ? snap.get('boardName') : '',
    allowedUsers,
    allowedUserIds,
  }
}

export async function canViewBoard(
  user: AuthedUser | undefined,
  boardFolderId: string,
): Promise<boolean> {
  if (!user) return false
  if (isSuperAdminUser(user)) return true
  const record = await getBoardAccessRecord(boardFolderId)
  return record?.allowedUserIds.includes(user.uid) ?? false
}

export async function getAccessibleBoardIds(uid: string): Promise<Set<string>> {
  const snap = await adminDb()
    .collection(BOARD_ACCESS_COLLECTION)
    .where('allowedUserIds', 'array-contains', uid)
    .get()
  return new Set(snap.docs.map((doc) => doc.id))
}

export async function hasAnyBoardAccess(user: AuthedUser): Promise<boolean> {
  if (isSuperAdminUser(user)) return true
  const snap = await adminDb()
    .collection(BOARD_ACCESS_COLLECTION)
    .where('allowedUserIds', 'array-contains', user.uid)
    .limit(1)
    .get()
  return !snap.empty
}

export async function resolveWorkspaceUserByEmail(
  email: string,
): Promise<{ uid: string; email: string; displayName: string } | null> {
  const normalized = email.trim().toLowerCase()
  const domain = getEnv().allowedEmailDomain
  if (!normalized || !isEmailInAllowedDomain(normalized, domain)) return null

  try {
    const authUser = await adminAuth().getUserByEmail(normalized)
    const profile = await adminDb().collection('users').doc(authUser.uid).get()
    if (!profile.exists) return null
    const displayName =
      (typeof profile.get('displayName') === 'string' && profile.get('displayName').trim()) ||
      normalized
    return { uid: authUser.uid, email: normalized, displayName }
  } catch {
    const snap = await adminDb()
      .collection('users')
      .where('email', '==', normalized)
      .limit(1)
      .get()
    if (snap.empty) return null
    const profile = snap.docs[0]
    const displayName =
      (typeof profile.get('displayName') === 'string' && profile.get('displayName').trim()) ||
      normalized
    return { uid: profile.id, email: normalized, displayName }
  }
}

export async function grantBoardAccess(input: {
  boardFolderId: string
  boardName: string
  grantee: { uid: string; email: string; displayName: string }
  actor: AuthedUser
}): Promise<{ granted: boolean; allowedUsers: BoardAccessGrantee[] }> {
  const ref = adminDb().collection(BOARD_ACCESS_COLLECTION).doc(input.boardFolderId)
  const existing = await ref.get()
  const allowedRaw = existing.exists ? existing.get('allowedUsers') : undefined
  const currentUsers = Array.isArray(allowedRaw)
    ? allowedRaw
        .map((row: unknown) => granteeFromFirestore(row))
        .filter((row): row is BoardAccessGrantee => row !== null)
    : []

  if (currentUsers.some((row) => row.uid === input.grantee.uid)) {
    return { granted: false, allowedUsers: currentUsers }
  }

  const grantedAt = Timestamp.now()
  const nextUser = {
    uid: input.grantee.uid,
    email: input.grantee.email,
    displayName: input.grantee.displayName,
    grantedAt,
    grantedBy: { uid: input.actor.uid, email: input.actor.email },
  }

  const allowedUsersForWrite = [
    ...currentUsers.map((row) => ({
      uid: row.uid,
      email: row.email,
      displayName: row.displayName,
      grantedAt: row.grantedAt,
      grantedBy: row.grantedBy,
    })),
    nextUser,
  ]
  const allowedUserIds = allowedUsersForWrite.map((row) => row.uid)

  await ref.set(
    {
      boardFolderId: input.boardFolderId,
      boardName: input.boardName,
      allowedUsers: allowedUsersForWrite,
      allowedUserIds,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUserId: input.actor.uid,
      updatedByEmail: input.actor.email,
    },
    { merge: true },
  )

  return {
    granted: true,
    allowedUsers: [...currentUsers, {
      uid: input.grantee.uid,
      email: input.grantee.email,
      displayName: input.grantee.displayName,
      grantedAt,
      grantedBy: nextUser.grantedBy,
    }],
  }
}

export async function revokeBoardAccess(input: {
  boardFolderId: string
  boardName: string
  granteeUid: string
  actor: AuthedUser
}): Promise<
  | { revoked: true; grantee: BoardAccessGrantee; allowedUsers: BoardAccessGrantee[] }
  | { revoked: false; reason: 'not_found' | 'missing_doc' }
> {
  const ref = adminDb().collection(BOARD_ACCESS_COLLECTION).doc(input.boardFolderId)
  const existing = await ref.get()
  if (!existing.exists) {
    return { revoked: false, reason: 'missing_doc' }
  }

  const allowedRaw = existing.get('allowedUsers')
  const currentUsers = Array.isArray(allowedRaw)
    ? allowedRaw
        .map((row: unknown) => granteeFromFirestore(row))
        .filter((row): row is BoardAccessGrantee => row !== null)
    : []

  const grantee = currentUsers.find((row) => row.uid === input.granteeUid)
  if (!grantee) {
    return { revoked: false, reason: 'not_found' }
  }

  const allowedUsers = currentUsers.filter((row) => row.uid !== input.granteeUid)
  const allowedUserIds = allowedUsers.map((row) => row.uid)

  await ref.set(
    {
      boardFolderId: input.boardFolderId,
      boardName: input.boardName,
      allowedUsers,
      allowedUserIds,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUserId: input.actor.uid,
      updatedByEmail: input.actor.email,
    },
    { merge: true },
  )

  return { revoked: true, grantee, allowedUsers }
}

export async function syncBoardName(boardFolderId: string, boardName: string): Promise<void> {
  try {
    const ref = adminDb().collection(BOARD_ACCESS_COLLECTION).doc(boardFolderId)
    const snap = await ref.get()
    if (!snap.exists) return
    if (snap.get('boardName') === boardName) return
    await ref.set({ boardName, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
  } catch (err) {
    logError('boardAccess: no se pudo sincronizar boardName', err)
  }
}
