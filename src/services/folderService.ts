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
import { logAction, logPermissionChanges } from './auditLogService'

const FOLDERS_COLLECTION = 'folders'
const RESOURCE_ITEMS_COLLECTION = 'resourceItems'

export interface Folder {
  id?: string
  name: string
  parentFolderId: string | null
  allowedUsers: string[]
  /** Id de la carpeta de primer nivel a la que pertenece. */
  rootAreaId?: string
  createdAt: Timestamp | Date
}

export interface ResourceItem {
  id?: string
  name: string
  url: string
  type: 'folder' | 'drive' | 'form' | 'link'
  folderId: string | null
  allowedUsers: string[]
  rootAreaId?: string
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
    rootAreaId: typeof data.rootAreaId === 'string' ? data.rootAreaId : undefined,
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
    rootAreaId: typeof data.rootAreaId === 'string' ? data.rootAreaId : undefined,
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

/** Resuelve el rootAreaId subiendo padres (o el propio id si es raíz). */
export async function resolveRootAreaIdForFolder(
  folderId: string,
): Promise<string | null> {
  const visited = new Set<string>()
  let currentId: string | null = folderId

  while (currentId) {
    if (visited.has(currentId)) return null
    visited.add(currentId)

    const folder = await getFolderById(currentId)
    if (!folder) return null

    if (folder.rootAreaId) return folder.rootAreaId
    if (folder.parentFolderId === null) return folder.id ?? currentId

    currentId = folder.parentFolderId
  }

  return null
}

export async function createFolder(
  name: string,
  parentFolderId: string | null,
  allowedUsers: string[] = [],
): Promise<string> {
  let rootAreaId: string | undefined

  if (parentFolderId) {
    const parent = await getFolderById(parentFolderId)
    if (!parent) {
      throw new Error('Carpeta padre no encontrada')
    }
    rootAreaId =
      parent.rootAreaId ??
      (parent.parentFolderId === null ? parent.id : undefined) ??
      (await resolveRootAreaIdForFolder(parentFolderId)) ??
      undefined

    if (!rootAreaId) {
      throw new Error(
        'No se pudo determinar el área de esta carpeta. Puede haber un dato inconsistente — avisale a Sistemas para revisarlo en Firestore.',
      )
    }
  }

  const payload: Record<string, unknown> = {
    name: name.trim(),
    parentFolderId,
    allowedUsers,
    createdAt: serverTimestamp(),
  }

  if (rootAreaId) {
    payload.rootAreaId = rootAreaId
  }

  const docRef = await addDoc(collection(db, FOLDERS_COLLECTION), payload)

  // Carpeta de primer nivel: rootAreaId = su propio id
  let finalRootAreaId = rootAreaId
  if (!parentFolderId) {
    await updateDoc(docRef, { rootAreaId: docRef.id })
    finalRootAreaId = docRef.id
  }

  await logAction({
    action: 'create',
    targetType: 'folder',
    targetId: docRef.id,
    targetName: name.trim(),
    parentFolderId,
    metadata: { rootAreaId: finalRootAreaId ?? null },
  })

  return docRef.id
}

export async function createResourceItem(
  data: Omit<ResourceItem, 'id' | 'createdAt' | 'rootAreaId'> & {
    rootAreaId?: string
  },
): Promise<string> {
  let rootAreaId = data.rootAreaId

  if (!rootAreaId && data.folderId) {
    rootAreaId = (await resolveRootAreaIdForFolder(data.folderId)) ?? undefined
  }

  if (data.folderId && !rootAreaId) {
    throw new Error(
      'No se pudo determinar el área de esta carpeta. Puede haber un dato inconsistente — avisale a Sistemas para revisarlo en Firestore.',
    )
  }

  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    url: data.url.trim(),
    type: data.type,
    folderId: data.folderId,
    allowedUsers: data.allowedUsers ?? [],
    createdAt: serverTimestamp(),
  }

  if (rootAreaId) {
    payload.rootAreaId = rootAreaId
  }

  const docRef = await addDoc(collection(db, RESOURCE_ITEMS_COLLECTION), payload)

  await logAction({
    action: 'create',
    targetType: 'resource',
    targetId: docRef.id,
    targetName: data.name.trim(),
    parentFolderId: data.folderId,
    metadata: { type: data.type, rootAreaId: rootAreaId ?? null },
  })

  return docRef.id
}

/**
 * Elimina una carpeta solo si está vacía.
 * Lanza un error descriptivo si contiene subcarpetas o recursos;
 * el UI debe capturarlo y mostrar la advertencia al administrador.
 */
export async function deleteFolder(folderId: string): Promise<void> {
  const folder = await getFolderById(folderId)
  if (!folder) {
    throw new Error('Carpeta no encontrada')
  }

  const children = await getFolderChildrenCount(folderId)

  if (children.folders > 0 || children.items > 0) {
    throw new Error(
      `La carpeta contiene ${children.folders} subcarpeta(s) y ${children.items} recurso(s). ` +
        'Eliminá su contenido antes de borrarla.',
    )
  }

  await deleteDoc(doc(db, FOLDERS_COLLECTION, folderId))

  await logAction({
    action: 'delete',
    targetType: 'folder',
    targetId: folderId,
    targetName: folder.name,
    parentFolderId: folder.parentFolderId,
    metadata: { rootAreaId: folder.rootAreaId ?? null },
  })
}

export async function deleteResourceItem(itemId: string): Promise<void> {
  const snapshot = await getDoc(doc(db, RESOURCE_ITEMS_COLLECTION, itemId))
  if (!snapshot.exists()) {
    throw new Error('Recurso no encontrado')
  }
  const item = mapDocToResourceItem(snapshot.id, snapshot.data())

  await deleteDoc(doc(db, RESOURCE_ITEMS_COLLECTION, itemId))

  await logAction({
    action: 'delete',
    targetType: 'resource',
    targetId: itemId,
    targetName: item.name,
    parentFolderId: item.folderId,
    metadata: { rootAreaId: item.rootAreaId ?? null },
  })
}

export async function updateFolderPermissions(
  folderId: string,
  allowedUsers: string[],
): Promise<void> {
  const folder = await getFolderById(folderId)
  if (!folder) {
    throw new Error('Carpeta no encontrada')
  }

  const before = folder.allowedUsers ?? []

  await updateDoc(doc(db, FOLDERS_COLLECTION, folderId), {
    allowedUsers,
  })

  await logPermissionChanges({
    targetType: 'folder',
    targetId: folderId,
    targetName: folder.name,
    parentFolderId: folder.parentFolderId,
    before,
    after: allowedUsers,
  })
}

export async function updateFolderName(folderId: string, name: string): Promise<void> {
  const folder = await getFolderById(folderId)
  if (!folder) {
    throw new Error('Carpeta no encontrada')
  }

  const trimmed = name.trim()
  const before = folder.name

  await updateDoc(doc(db, FOLDERS_COLLECTION, folderId), {
    name: trimmed,
  })

  if (before !== trimmed) {
    await logAction({
      action: 'rename',
      targetType: 'folder',
      targetId: folderId,
      targetName: trimmed,
      parentFolderId: folder.parentFolderId,
      metadata: { antes: before, despues: trimmed, rootAreaId: folder.rootAreaId ?? null },
    })
  }
}

export async function updateResourceItem(
  itemId: string,
  data: Pick<ResourceItem, 'name' | 'url' | 'type'>,
): Promise<void> {
  const snapshot = await getDoc(doc(db, RESOURCE_ITEMS_COLLECTION, itemId))
  if (!snapshot.exists()) {
    throw new Error('Recurso no encontrado')
  }
  const item = mapDocToResourceItem(snapshot.id, snapshot.data())

  const trimmedName = data.name.trim()

  await updateDoc(doc(db, RESOURCE_ITEMS_COLLECTION, itemId), {
    name: trimmedName,
    url: data.url.trim(),
    type: data.type,
  })

  if (item.name !== trimmedName) {
    await logAction({
      action: 'rename',
      targetType: 'resource',
      targetId: itemId,
      targetName: trimmedName,
      parentFolderId: item.folderId,
      metadata: { antes: item.name, despues: trimmedName, rootAreaId: item.rootAreaId ?? null },
    })
  }
}

export async function updateResourcePermissions(
  itemId: string,
  allowedUsers: string[],
): Promise<void> {
  const snapshot = await getDoc(doc(db, RESOURCE_ITEMS_COLLECTION, itemId))
  if (!snapshot.exists()) {
    throw new Error('Recurso no encontrado')
  }
  const item = mapDocToResourceItem(snapshot.id, snapshot.data())
  const before = item.allowedUsers ?? []

  await updateDoc(doc(db, RESOURCE_ITEMS_COLLECTION, itemId), {
    allowedUsers,
  })

  await logPermissionChanges({
    targetType: 'resource',
    targetId: itemId,
    targetName: item.name,
    parentFolderId: item.folderId,
    before,
    after: allowedUsers,
  })
}

export async function getFolderById(folderId: string): Promise<Folder | null> {
  const snapshot = await getDoc(doc(db, FOLDERS_COLLECTION, folderId))

  if (!snapshot.exists()) {
    return null
  }

  return mapDocToFolder(snapshot.id, snapshot.data())
}
