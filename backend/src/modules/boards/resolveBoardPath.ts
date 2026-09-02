import { getDrive } from '../../lib/google/driveClient.js'
import { sanitizeDriveId } from '../../lib/google/driveIds.js'
import { getFileInSharedDrive } from '../drive/assertInSharedDrive.js'
import { getBoardsConfig } from './policy.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

export function normalizeRelativePath(raw: string): string | null {
  const trimmed = raw.trim().replace(/^\/+/, '')
  if (!trimmed) return 'index.html'
  const segments = trimmed.split('/').filter(Boolean)
  if (segments.some((seg) => seg === '..' || seg === '.' || seg.includes('\\'))) {
    return null
  }
  return segments.join('/')
}

export async function assertDirectBoardFolder(
  boardFolderId: string,
): Promise<{ ok: true; name: string } | { ok: false; status: number; error: string }> {
  const { containerFolderId } = getBoardsConfig()
  if (!containerFolderId) {
    return { ok: false, status: 503, error: 'Tableros no configurados' }
  }

  const found = await getFileInSharedDrive(boardFolderId)
  if (!found.ok) return found
  if (found.file.trashed) {
    return { ok: false, status: 404, error: 'Tablero no encontrado' }
  }
  if (found.file.mimeType !== FOLDER_MIME) {
    return { ok: false, status: 400, error: 'No es una carpeta de tablero' }
  }
  if (found.file.parentFolderId !== containerFolderId) {
    return { ok: false, status: 403, error: 'Tablero fuera del contenedor autorizado' }
  }

  return { ok: true, name: found.file.name }
}

export async function resolveFileInBoardTree(
  boardFolderId: string,
  relativePath: string,
): Promise<
  | { ok: true; fileId: string; name: string; mimeType: string | null }
  | { ok: false; status: number; error: string }
> {
  const boardCheck = await assertDirectBoardFolder(boardFolderId)
  if (!boardCheck.ok) return boardCheck

  const segments = relativePath.split('/')
  let parentId = boardFolderId

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isLast = i === segments.length - 1
    const drive = await getDrive()
    const listed = await drive.files.list({
      q: `'${parentId}' in parents and name = '${escapeDriveQueryValue(segment)}' and trashed = false`,
      fields: 'files(id, name, mimeType)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      pageSize: 5,
    })

    const match = listed.data.files?.[0]
    if (!match?.id) {
      return { ok: false, status: 404, error: 'Archivo no encontrado en el tablero' }
    }

    if (isLast) {
      if (match.mimeType === FOLDER_MIME) {
        return { ok: false, status: 404, error: 'La ruta apunta a una carpeta, no a un archivo' }
      }
      return {
        ok: true,
        fileId: match.id,
        name: match.name ?? segment,
        mimeType: match.mimeType ?? null,
      }
    }

    if (match.mimeType !== FOLDER_MIME) {
      return { ok: false, status: 404, error: 'Ruta inválida en el tablero' }
    }
    parentId = match.id
  }

  return { ok: false, status: 404, error: 'Archivo no encontrado' }
}

export function sanitizeBoardFolderId(raw: string): string | null {
  return sanitizeDriveId(raw)
}
