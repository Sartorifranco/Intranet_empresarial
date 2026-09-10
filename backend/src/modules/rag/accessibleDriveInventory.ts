import type { drive_v3 } from 'googleapis'
import { adminDb } from '../../lib/firebase/admin.js'
import { getStoredClassification } from '../drive/classification.js'
import { resolveFileGoverningAreaId } from '../drive/governDriveFile.js'
import { isExcludedGoverningArea } from './regulatoryArea.js'
import { mimeToKind } from './mimeKind.js'
import type { RagConfig } from './types.js'
import { walkDriveFolder, type DriveWalkFile, type DriveWalkFolder } from './walkDriveFolder.js'

export type AccessibleDriveFile = DriveWalkFile & {
  fileKind: string
  governingAreaId: string | null
  uploaderEmail: string | null
}

export type AccessibleFolder = {
  id: string
  name: string
  parentFolderId: string | null
  directFileCount: number
}

export type AccessibleInventory = {
  areaLabel: string
  governingAreaId: string
  foldersVisited: number
  folders: AccessibleFolder[]
  files: AccessibleDriveFile[]
}

const inventoryCache = new Map<
  string,
  { expiresAt: number; inventory: AccessibleInventory }
>()
const CACHE_TTL_MS = 2 * 60_000

async function resolveUploaderEmail(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<string | null> {
  const snap = await adminDb().collection('driveFiles').doc(fileId).get()
  if (snap.exists) {
    const createdBy = snap.get('createdByEmail')
    if (typeof createdBy === 'string' && createdBy.trim()) {
      return createdBy.trim().toLowerCase()
    }
  }

  try {
    const meta = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'owners(emailAddress)',
    })
    const owner = meta.data.owners?.[0]?.emailAddress
    return typeof owner === 'string' && owner.trim() ? owner.trim().toLowerCase() : null
  } catch {
    return null
  }
}

async function fileIsAccessibleToUser(
  drive: drive_v3.Drive,
  fileId: string,
): Promise<boolean> {
  try {
    await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'id,trashed',
    })
    return true
  } catch {
    return false
  }
}

async function filterAccessibleFiles(
  drive: drive_v3.Drive,
  files: DriveWalkFile[],
  config: RagConfig,
): Promise<AccessibleDriveFile[]> {
  const accessible: AccessibleDriveFile[] = []
  const batchSize = 20

  for (let offset = 0; offset < files.length; offset += batchSize) {
    const batch = files.slice(offset, offset + batchSize)
    const results = await Promise.all(
      batch.map(async (file) => {
        const classification = await getStoredClassification(file.id)
        if (classification === 'RESTRINGIDO') return null

        const governingAreaId = await resolveFileGoverningAreaId(file.id, file.parentFolderId)
        if (isExcludedGoverningArea(governingAreaId, config)) return null

        if (!(await fileIsAccessibleToUser(drive, file.id))) return null

        return {
          ...file,
          fileKind: mimeToKind(file.mimeType),
          governingAreaId,
          uploaderEmail: null,
        } satisfies AccessibleDriveFile
      }),
    )

    for (const row of results) {
      if (row) accessible.push(row)
    }
  }

  return accessible
}

function buildAccessibleFolders(
  allFolders: DriveWalkFolder[],
  accessibleFiles: AccessibleDriveFile[],
): AccessibleFolder[] {
  const fileCountByFolder = new Map<string, number>()
  const accessibleFolderIds = new Set<string>()

  for (const file of accessibleFiles) {
    if (!file.parentFolderId) continue
    accessibleFolderIds.add(file.parentFolderId)
    fileCountByFolder.set(
      file.parentFolderId,
      (fileCountByFolder.get(file.parentFolderId) ?? 0) + 1,
    )
  }

  return allFolders
    .filter((folder) => accessibleFolderIds.has(folder.id))
    .map((folder) => ({
      id: folder.id,
      name: folder.name,
      parentFolderId: folder.parentFolderId,
      directFileCount: fileCountByFolder.get(folder.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function findAccessibleFolder(
  inventory: AccessibleInventory,
  query: string,
): AccessibleFolder | null {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return null

  const exact = inventory.folders.find((folder) => folder.name.toLowerCase() === normalized)
  if (exact) return exact

  const partial = inventory.folders.filter((folder) =>
    folder.name.toLowerCase().includes(normalized),
  )
  if (partial.length === 1) return partial[0] ?? null
  return null
}

export async function loadAccessibleInventory(input: {
  drive: drive_v3.Drive
  config: RagConfig
  searchSubject: string
}): Promise<AccessibleInventory> {
  const cacheKey = `${input.searchSubject}:${input.config.pilot.governingAreaId}`
  const now = Date.now()
  const cached = inventoryCache.get(cacheKey)
  if (cached && cached.expiresAt > now) {
    return cached.inventory
  }

  const { files, folders, foldersVisited } = await walkDriveFolder(
    input.drive,
    input.config.pilot.driveFolderId,
  )
  const accessibleFiles = await filterAccessibleFiles(input.drive, files, input.config)
  const accessibleFolders = buildAccessibleFolders(folders, accessibleFiles)

  const inventory: AccessibleInventory = {
    areaLabel: input.config.pilot.label,
    governingAreaId: input.config.pilot.governingAreaId,
    foldersVisited,
    folders: accessibleFolders,
    files: accessibleFiles,
  }

  inventoryCache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, inventory })
  return inventory
}

export function findAccessibleFileByName(
  inventory: AccessibleInventory,
  fileNameQuery: string,
): AccessibleDriveFile[] {
  const query = fileNameQuery.trim().toLowerCase()
  if (!query) return []

  const exact = inventory.files.filter((file) => file.name.toLowerCase() === query)
  if (exact.length > 0) return exact

  return inventory.files.filter((file) => file.name.toLowerCase().includes(query))
}

export async function enrichUploader(
  drive: drive_v3.Drive,
  file: AccessibleDriveFile,
): Promise<AccessibleDriveFile> {
  if (file.uploaderEmail) return file
  const uploaderEmail = await resolveUploaderEmail(drive, file.id)
  return { ...file, uploaderEmail }
}

export function clearAccessibleInventoryCache(searchSubject?: string): void {
  if (!searchSubject) {
    inventoryCache.clear()
    return
  }
  for (const key of inventoryCache.keys()) {
    if (key.startsWith(`${searchSubject}:`)) {
      inventoryCache.delete(key)
    }
  }
}
