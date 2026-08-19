import { createUserWithEmailAndPassword, updateProfile, type User } from 'firebase/auth'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore'
import { removeUserFromAllDriveFiles } from './googleDriveService'
import { auth, db } from './firebase'

const USERS_COLLECTION = 'users'

export type UserDepartment = string

export interface UserPermissions {
  view_directory: boolean
  view_drive: boolean
  view_links: boolean
  manage_news: boolean
  manage_links: boolean
  manage_users: boolean
  super_admin: boolean
}

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  department: UserDepartment
  permissions: UserPermissions
  favoriteApps: string[]
  birthDate?: string
}

export const DEFAULT_PERMISSIONS: UserPermissions = {
  view_directory: true,
  view_drive: true,
  view_links: true,
  manage_news: false,
  manage_links: false,
  manage_users: false,
  super_admin: false,
}

export const SUPER_ADMIN_EMAILS = [
  'admin@bacarsa.com.ar',
  'sistemas.ti@bacarsa.com.ar',
] as const

export const SUPER_ADMIN_PERMISSIONS: UserPermissions = {
  view_directory: true,
  view_drive: true,
  view_links: true,
  manage_news: true,
  manage_links: true,
  manage_users: true,
  super_admin: true,
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalized = email.trim().toLowerCase()
  return SUPER_ADMIN_EMAILS.some((adminEmail) => adminEmail === normalized)
}

export function getPermissionsForEmail(email: string | null | undefined): UserPermissions {
  return isSuperAdminEmail(email) ? SUPER_ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS
}

function mapDocToUserProfile(uid: string, data: DocumentData): UserProfile {
  const permissions = data.permissions ?? {}

  return {
    uid,
    email: data.email ?? '',
    displayName: data.displayName ?? '',
    department: (data.department as UserDepartment) ?? 'General',
    permissions: {
      view_directory: permissions.view_directory ?? DEFAULT_PERMISSIONS.view_directory,
      view_drive: permissions.view_drive ?? DEFAULT_PERMISSIONS.view_drive,
      view_links: permissions.view_links ?? DEFAULT_PERMISSIONS.view_links,
      manage_news: permissions.manage_news ?? false,
      manage_links: permissions.manage_links ?? false,
      manage_users: permissions.manage_users ?? false,
      super_admin: permissions.super_admin ?? false,
    },
    favoriteApps: Array.isArray(data.favoriteApps)
      ? (data.favoriteApps as string[])
      : [],
    birthDate: typeof data.birthDate === 'string' ? data.birthDate : undefined,
  }
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  department: UserDepartment,
  birthDate: string,
): Promise<string> {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  const { uid } = credential.user

  await updateProfile(credential.user, { displayName: name.trim() })

  await setDoc(doc(db, USERS_COLLECTION, uid), {
    email,
    displayName: name.trim(),
    department,
    birthDate,
    permissions: getPermissionsForEmail(email),
    favoriteApps: [],
  })

  return uid
}

export async function ensureGoogleUserProfile(user: User): Promise<void> {
  const userRef = doc(db, USERS_COLLECTION, user.uid)
  const snapshot = await getDoc(userRef)

  if (snapshot.exists()) {
    return
  }

  await setDoc(userRef, {
    email: user.email ?? '',
    displayName:
      user.displayName?.trim() ||
      user.email?.split('@')[0] ||
      'Usuario',
    department: 'General',
    permissions: getPermissionsForEmail(user.email),
    favoriteApps: [],
  })
}

export async function ensureSuperAdminPermissions(
  uid: string,
  email: string | null | undefined,
): Promise<void> {
  if (!isSuperAdminEmail(email)) return

  const userRef = doc(db, USERS_COLLECTION, uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) return

  const current = snapshot.data().permissions ?? {}
  const needsUpdate =
    current.super_admin !== true ||
    current.manage_users !== true ||
    current.manage_news !== true ||
    current.manage_links !== true

  if (!needsUpdate) return

  await updateDoc(userRef, {
    permissions: SUPER_ADMIN_PERMISSIONS,
  })
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, USERS_COLLECTION, uid))

  if (!snapshot.exists()) {
    return null
  }

  return mapDocToUserProfile(uid, snapshot.data())
}

export async function getAllUsers(): Promise<UserProfile[]> {
  const usersQuery = query(
    collection(db, USERS_COLLECTION),
    orderBy('displayName', 'asc'),
  )

  const snapshot = await getDocs(usersQuery)

  if (snapshot.empty) {
    return []
  }

  return snapshot.docs.map((document) =>
    mapDocToUserProfile(document.id, document.data()),
  )
}

export async function updateUserPermissions(
  uid: string,
  newPermissions: UserPermissions,
): Promise<void> {
  await updateDoc(doc(db, USERS_COLLECTION, uid), {
    permissions: newPermissions,
  })
}

export async function updateUserBasicInfo(
  uid: string,
  data: {
    displayName: string
    email: string
    department: UserDepartment
  },
): Promise<void> {
  // Actualiza el documento en Firestore. Cambiar email/displayName en Firebase Auth
  // de otros usuarios requiere Admin SDK o una Cloud Function en producción.
  await updateDoc(doc(db, USERS_COLLECTION, uid), {
    displayName: data.displayName.trim(),
    email: data.email.trim(),
    department: data.department,
  })
}

export async function toggleFavoriteApp(userId: string, appId: string): Promise<string[]> {
  const profile = await getUserProfile(userId)
  const current = profile?.favoriteApps ?? []
  const next = current.includes(appId)
    ? current.filter((id) => id !== appId)
    : [...current, appId]

  await updateDoc(doc(db, USERS_COLLECTION, userId), {
    favoriteApps: next,
  })

  return next
}

/**
 * Elimina el perfil de Firestore y limpia referencias en archivos de Drive.
 *
 * NOTA: La cuenta en Firebase Authentication NO se elimina desde el SDK del cliente.
 * En producción, usá una Cloud Function con Admin SDK o eliminá el usuario manualmente
 * en Firebase Console → Authentication.
 */
export async function deleteUser(uid: string): Promise<void> {
  await removeUserFromAllDriveFiles(uid)
  await deleteDoc(doc(db, USERS_COLLECTION, uid))
}

export function canManageUsers(permissions: UserPermissions | undefined): boolean {
  return !!(permissions?.super_admin || permissions?.manage_users)
}

export function canManageDirectory(
  email: string | null | undefined,
  permissions?: UserPermissions,
): boolean {
  return isSuperAdminEmail(email) || permissions?.super_admin === true
}

/** Turnos: solo los dos perfiles administradores (sistemas.ti y admin). */
export function canManageShifts(email: string | null | undefined): boolean {
  return isSuperAdminEmail(email)
}
