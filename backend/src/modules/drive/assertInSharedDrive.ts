import { getDrive } from '../../lib/google/driveClient.js'
import { getSharedDriveRootId } from '../../lib/google/sharedDrive.js'
import { logError } from '../../lib/log.js'

export function googleStatus(err: unknown): number | undefined {
  const e = err as { code?: number; status?: number }
  if (typeof e.code === 'number') return e.code
  if (typeof e.status === 'number') return e.status
  return undefined
}

export function googleUserMessage(err: unknown): string | null {
  const e = err as { message?: string; errors?: Array<{ message?: string }> }
  const raw = e.errors?.[0]?.message ?? e.message
  if (!raw || typeof raw !== 'string') return null
  const userMsg = raw.match(/User message:\s*"([^"]+)"/)
  if (userMsg?.[1]) return userMsg[1]
  return raw
}

export type DriveFileInShared = {
  id: string
  name: string
  mimeType: string | null
  parentFolderId: string | null
  trashed: boolean
}

export async function getFileInSharedDrive(
  fileId: string,
  subject?: string,
): Promise<{ ok: true; file: DriveFileInShared } | { ok: false; status: number; error: string }> {
  const driveId = getSharedDriveRootId()

  try {
    const drive = await getDrive(subject)
    const meta = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, parents, driveId, trashed',
    })

    const fileDriveId = meta.data.driveId ?? (fileId === driveId ? driveId : null)
    if (fileDriveId !== driveId) {
      return { ok: false, status: 400, error: 'El archivo no pertenece a la Unidad compartida' }
    }

    return {
      ok: true,
      file: {
        id: meta.data.id ?? fileId,
        name: meta.data.name ?? fileId,
        mimeType: meta.data.mimeType ?? null,
        parentFolderId: meta.data.parents?.[0] ?? null,
        trashed: Boolean(meta.data.trashed),
      },
    }
  } catch (err) {
    const status = googleStatus(err)
    if (status === 404) {
      return { ok: false, status: 404, error: 'Archivo no encontrado' }
    }
    if (status === 403) {
      return { ok: false, status: 403, error: 'No tenés permiso para acceder a este archivo' }
    }
    logError('Drive files.get falló', err)
    return { ok: false, status: 502, error: 'No se pudo leer el archivo' }
  }
}
