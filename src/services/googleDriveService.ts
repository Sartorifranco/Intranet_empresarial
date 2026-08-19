import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  writeBatch,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

const SHARED_FILES_COLLECTION = 'sharedFiles'

export type GoogleFileType = 'folder' | 'sheet' | 'doc' | 'slide'

export type GoogleFileDepartment = 'Sistemas' | 'Operaciones' | 'General'

export interface GoogleSharedFile {
  id?: string
  title: string
  url: string
  type: GoogleFileType
  department: GoogleFileDepartment
  description: string
  allowedUsers?: string[]
}

function normalizeAllowedUsers(data: DocumentData): string[] {
  const raw = data.allowedUsers
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function mapDocToGoogleSharedFile(id: string, data: DocumentData): GoogleSharedFile {
  const allowedUsers = normalizeAllowedUsers(data)

  return {
    id,
    title: data.title ?? '',
    url: data.url ?? '',
    type: (data.type as GoogleFileType) ?? 'doc',
    department: (data.department as GoogleFileDepartment) ?? 'General',
    description: data.description ?? '',
    allowedUsers,
  }
}

export function isSharedFilePublic(file: GoogleSharedFile): boolean {
  return !file.allowedUsers || file.allowedUsers.length === 0
}

export function canUserAccessFile(file: GoogleSharedFile, uid: string | undefined): boolean {
  if (isSharedFilePublic(file)) return true
  if (!uid) return false
  return file.allowedUsers!.includes(uid)
}

export function filterSharedFilesForUser(
  files: GoogleSharedFile[],
  uid: string | undefined,
): GoogleSharedFile[] {
  return files.filter((file) => canUserAccessFile(file, uid))
}

export async function getSharedFiles(): Promise<GoogleSharedFile[]> {
  const filesQuery = query(
    collection(db, SHARED_FILES_COLLECTION),
    orderBy('department', 'asc'),
  )

  const snapshot = await getDocs(filesQuery)

  if (snapshot.empty) {
    return []
  }

  const files = snapshot.docs
    .map((document) => {
      try {
        return mapDocToGoogleSharedFile(document.id, document.data())
      } catch (error) {
        console.error(`Error al mapear el archivo ${document.id}:`, error)
        return null
      }
    })
    .filter((file): file is GoogleSharedFile => file !== null)

  return files.sort((a, b) => {
    const byDepartment = a.department.localeCompare(b.department, 'es')
    return byDepartment !== 0 ? byDepartment : a.title.localeCompare(b.title, 'es')
  })
}

export async function createSharedFile(
  file: Omit<GoogleSharedFile, 'id'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, SHARED_FILES_COLLECTION), {
    title: file.title,
    url: file.url,
    type: file.type,
    department: file.department,
    description: file.description,
    allowedUsers: file.allowedUsers ?? [],
  })

  return docRef.id
}

export async function setUserFileAccess(
  fileId: string,
  userId: string,
  granted: boolean,
): Promise<void> {
  const docRef = doc(db, SHARED_FILES_COLLECTION, fileId)
  const snapshot = await getDoc(docRef)

  if (!snapshot.exists()) {
    throw new Error('Archivo no encontrado')
  }

  const current = normalizeAllowedUsers(snapshot.data())
  const next = granted
    ? current.includes(userId)
      ? current
      : [...current, userId]
    : current.filter((id) => id !== userId)

  await updateDoc(docRef, { allowedUsers: next })
}

export async function removeUserFromAllDriveFiles(userId: string): Promise<void> {
  const snapshot = await getDocs(collection(db, SHARED_FILES_COLLECTION))

  const batch = writeBatch(db)
  let pendingUpdates = 0

  snapshot.docs.forEach((document) => {
    const current = normalizeAllowedUsers(document.data())
    if (current.includes(userId)) {
      batch.update(document.ref, {
        allowedUsers: current.filter((id) => id !== userId),
      })
      pendingUpdates += 1
    }
  })

  if (pendingUpdates > 0) {
    await batch.commit()
  }
}

export async function deleteSharedFile(id: string): Promise<void> {
  await deleteDoc(doc(db, SHARED_FILES_COLLECTION, id))
}
