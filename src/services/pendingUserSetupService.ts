import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  type Timestamp,
} from 'firebase/firestore'
import { auth, db } from './firebase'
import type { UserRole } from './userService'

const PENDING_USER_SETUP_COLLECTION = 'pendingUserSetup'

export interface PendingBoardAccess {
  boardFolderId: string
  boardName?: string
}

export interface PendingUserSetupPermissions {
  view_directory: boolean
  view_drive: boolean
}

export interface PendingUserSetup {
  email: string
  role: 'admin' | 'user'
  managedAreaIds: string[]
  memberAreaIds: string[]
  permissions: PendingUserSetupPermissions
  boardAccess: PendingBoardAccess[]
  note?: string
  applied?: boolean
  appliedAt?: Timestamp
  appliedToUid?: string
  createdAt?: Timestamp
  createdByUid?: string
  createdByEmail?: string
}

export interface PendingUserSetupInput {
  email: string
  role: 'admin' | 'user'
  managedAreaIds: string[]
  memberAreaIds: string[]
  permissions: PendingUserSetupPermissions
  boardAccess: PendingBoardAccess[]
  note?: string
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function parseBoardAccess(value: unknown): PendingBoardAccess[] {
  if (!Array.isArray(value)) return []
  const rows: PendingBoardAccess[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue
    const record = row as Record<string, unknown>
    const boardFolderId =
      typeof record.boardFolderId === 'string' ? record.boardFolderId.trim() : ''
    if (!boardFolderId) continue
    const boardNameRaw = record.boardName
    const entry: PendingBoardAccess = { boardFolderId }
    if (typeof boardNameRaw === 'string' && boardNameRaw.trim()) {
      entry.boardName = boardNameRaw.trim()
    }
    rows.push(entry)
  }
  return rows
}

function mapDoc(id: string, data: Record<string, unknown>): PendingUserSetup {
  const roleRaw = data.role
  const role: UserRole =
    roleRaw === 'admin' ? 'admin' : 'user'
  const permissionsRaw = data.permissions
  const permissions =
    permissionsRaw && typeof permissionsRaw === 'object' && !Array.isArray(permissionsRaw)
      ? {
          view_directory:
            (permissionsRaw as Record<string, unknown>).view_directory !== false,
          view_drive: (permissionsRaw as Record<string, unknown>).view_drive !== false,
        }
      : { view_directory: true, view_drive: true }

  return {
    email: id,
    role,
    managedAreaIds: normalizeStringArray(data.managedAreaIds),
    memberAreaIds: normalizeStringArray(data.memberAreaIds),
    permissions,
    boardAccess: parseBoardAccess(data.boardAccess),
    note: typeof data.note === 'string' ? data.note : undefined,
    applied: data.applied === true,
    appliedAt: data.appliedAt as Timestamp | undefined,
    appliedToUid: typeof data.appliedToUid === 'string' ? data.appliedToUid : undefined,
    createdAt: data.createdAt as Timestamp | undefined,
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : undefined,
    createdByEmail: typeof data.createdByEmail === 'string' ? data.createdByEmail : undefined,
  }
}

export async function listPendingUserSetups(): Promise<PendingUserSetup[]> {
  const snap = await getDocs(collection(db, PENDING_USER_SETUP_COLLECTION))
  return snap.docs
    .map((docSnap) => mapDoc(docSnap.id, docSnap.data()))
    .sort((a, b) => a.email.localeCompare(b.email, 'es', { sensitivity: 'base' }))
}

export async function getPendingUserSetup(email: string): Promise<PendingUserSetup | null> {
  const normalized = normalizeEmail(email)
  const snap = await getDoc(doc(db, PENDING_USER_SETUP_COLLECTION, normalized))
  if (!snap.exists()) return null
  return mapDoc(snap.id, snap.data())
}

export async function savePendingUserSetup(input: PendingUserSetupInput): Promise<void> {
  const normalized = normalizeEmail(input.email)
  if (!normalized.includes('@')) {
    throw new Error('Email inválido')
  }

  const existing = await getDoc(doc(db, PENDING_USER_SETUP_COLLECTION, normalized))
  if (existing.exists() && existing.data()?.applied === true) {
    throw new Error('Esta configuración ya fue aplicada y no se puede editar')
  }

  const actor = auth.currentUser
  await setDoc(
    doc(db, PENDING_USER_SETUP_COLLECTION, normalized),
    {
      email: normalized,
      role: input.role,
      managedAreaIds: input.managedAreaIds,
      memberAreaIds: input.memberAreaIds,
      permissions: input.permissions,
      boardAccess: input.boardAccess,
      note: input.note?.trim() || null,
      createdAt: existing.exists() ? existing.data()?.createdAt ?? serverTimestamp() : serverTimestamp(),
      createdByUid: existing.exists()
        ? existing.data()?.createdByUid ?? actor?.uid ?? null
        : actor?.uid ?? null,
      createdByEmail: existing.exists()
        ? existing.data()?.createdByEmail ?? actor?.email ?? null
        : actor?.email ?? null,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function deletePendingUserSetup(email: string): Promise<void> {
  const normalized = normalizeEmail(email)
  await deleteDoc(doc(db, PENDING_USER_SETUP_COLLECTION, normalized))
}
