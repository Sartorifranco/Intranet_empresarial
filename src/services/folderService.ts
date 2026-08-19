import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

const FOLDERS_COLLECTION = 'folders'
const RESOURCE_ITEMS_COLLECTION = 'resourceItems'

export interface Folder {
  id?: string
  name: string
  parentFolderId: string | null
  allowedUsers: string[]
  createdAt: Timestamp | Date
}

export interface ResourceItem {
  id?: string
  name: string
  url: string
  type: 'folder' | 'drive' | 'form' | 'link'
  folderId: string | null
  allowedUsers: string[]
  createdAt: Timestamp | Date
}

export interface FolderLevelContents {
  folders: Folder[]
  items: ResourceItem[]
}

function toDate(value: Timestamp | Date): Date {
  return value instanceof Timestamp ? value.toDate() : value
}

function normalizeAllowedUsers(data: DocumentData): string[] {
  const raw = data.allowedUsers
  if (!Array.isArray(raw)) return []
  return raw.filter((id): id is string => typeof id === 'string' && id.length > 0)
}

function mapDocToFolder(id: string, data: DocumentData): Folder {
  return {
    id,
    name: data.name ?? '',
    parentFolderId: (data.parentFolderId as string | null) ?? null,
    allowedUsers: normalizeAllowedUsers(data),
    createdAt: data.createdAt ? toDate(data.createdAt as Timestamp) : new Date(),
  }
}

function mapDocToResourceItem(id: string, data: DocumentData): ResourceItem {
  return {
    id,
    name: data.name ?? '',
    url: data.url ?? '',
    type: (data.type as ResourceItem['type']) ?? 'link',
    folderId: (data.folderId as string | null) ?? null,
    allowedUsers: normalizeAllowedUsers(data),
    createdAt: data.createdAt ? toDate(data.createdAt as Timestamp) : new Date(),
  }
}

function sortByName<T extends { name: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function isFolderPublic(folder: Folder): boolean {
  return folder.allowedUsers.length === 0
}

export function isResourcePublic(item: ResourceItem): boolean {
  return item.allowedUsers.length === 0
}

export function canUserAccessFolder(folder: Folder, uid: string | undefined): boolean {
  if (isFolderPublic(folder)) return true
  if (!uid) return false
  return folder.allowedUsers.includes(uid)
}

export function canUserAccessResource(item: ResourceItem, uid: string | undefined): boolean {
  if (isResourcePublic(item)) return true
  if (!uid) return false
  return item.allowedUsers.includes(uid)
}

export function filterLevelContentsForUser(
  contents: FolderLevelContents,
  uid: string | undefined,
): FolderLevelContents {
  return {
    folders: contents.folders.filter((folder) => canUserAccessFolder(folder, uid)),
    items: contents.items.filter((item) => canUserAccessResource(item, uid)),
  }
}

async function getFolderChildrenCount(
  folderId: string,
): Promise<{ folders: number; items: number }> {
  const [foldersSnapshot, itemsSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, FOLDERS_COLLECTION),
        where('parentFolderId', '==', folderId),
      ),
    ),
    getDocs(
      query(
        collection(db, RESOURCE_ITEMS_COLLECTION),
        where('folderId', '==', folderId),
      ),
    ),
  ])

  return {
    folders: foldersSnapshot.size,
    items: itemsSnapshot.size,
  }
}

export async function getFoldersAndItems(
  parentFolderId: string | null,
): Promise<FolderLevelContents> {
  const [foldersSnapshot, itemsSnapshot] = await Promise.all([
    getDocs(
      query(
        collection(db, FOLDERS_COLLECTION),
        where('parentFolderId', '==', parentFolderId),
      ),
    ),
    getDocs(
      query(
        collection(db, RESOURCE_ITEMS_COLLECTION),
        where('folderId', '==', parentFolderId),
      ),
    ),
  ])

  const folders = sortByName(
    foldersSnapshot.docs.map((document) =>
      mapDocToFolder(document.id, document.data()),
    ),
  )

  const items = sortByName(
    itemsSnapshot.docs.map((document) =>
      mapDocToResourceItem(document.id, document.data()),
    ),
  )

  return { folders, items }
}

export async function createFolder(
  name: string,
  parentFolderId: string | null,
  allowedUsers: string[] = [],
): Promise<string> {
  const docRef = await addDoc(collection(db, FOLDERS_COLLECTION), {
    name: name.trim(),
    parentFolderId,
    allowedUsers,
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

export async function createResourceItem(
  data: Omit<ResourceItem, 'id' | 'createdAt'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, RESOURCE_ITEMS_COLLECTION), {
    name: data.name.trim(),
    url: data.url.trim(),
    type: data.type,
    folderId: data.folderId,
    allowedUsers: data.allowedUsers ?? [],
    createdAt: serverTimestamp(),
  })

  return docRef.id
}

/**
 * Elimina una carpeta solo si está vacía.
 * Lanza un error descriptivo si contiene subcarpetas o recursos;
 * el UI debe capturarlo y mostrar la advertencia al administrador.
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const children = await getFolderChildrenCount(folderId)

  if (children.folders > 0 || children.items > 0) {
    throw new Error(
      `La carpeta contiene ${children.folders} subcarpeta(s) y ${children.items} recurso(s). ` +
        'Eliminá su contenido antes de borrarla.',
    )
  }

  await deleteDoc(doc(db, FOLDERS_COLLECTION, folderId))
}

export async function updateFolderPermissions(
  folderId: string,
  allowedUsers: string[],
): Promise<void> {
  await updateDoc(doc(db, FOLDERS_COLLECTION, folderId), {
    allowedUsers,
  })
}

export async function updateFolderName(folderId: string, name: string): Promise<void> {
  await updateDoc(doc(db, FOLDERS_COLLECTION, folderId), {
    name: name.trim(),
  })
}

export async function updateResourceItem(
  itemId: string,
  data: Pick<ResourceItem, 'name' | 'url' | 'type'>,
): Promise<void> {
  await updateDoc(doc(db, RESOURCE_ITEMS_COLLECTION, itemId), {
    name: data.name.trim(),
    url: data.url.trim(),
    type: data.type,
  })
}

export async function updateResourcePermissions(
  itemId: string,
  allowedUsers: string[],
): Promise<void> {
  await updateDoc(doc(db, RESOURCE_ITEMS_COLLECTION, itemId), {
    allowedUsers,
  })
}

export async function getFolderById(folderId: string): Promise<Folder | null> {
  const snapshot = await getDoc(doc(db, FOLDERS_COLLECTION, folderId))

  if (!snapshot.exists()) {
    return null
  }

  return mapDocToFolder(snapshot.id, snapshot.data())
}
