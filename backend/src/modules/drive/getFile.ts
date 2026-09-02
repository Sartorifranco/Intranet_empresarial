import type { Request, Response } from 'express'
import { sanitizeDriveId } from '../../lib/google/driveIds.js'
import { getDrive } from '../../lib/google/driveClient.js'
import { getFileInSharedDrive, googleStatus, googleUserMessage } from './assertInSharedDrive.js'
import { resolveDriveSubject } from './driveSubject.js'
import { logError } from '../../lib/log.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function getDriveFile(req: Request, res: Response): Promise<void> {
  const user = req.authedUser
  if (!user) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }

  const fileId = sanitizeDriveId(String(req.params.fileId ?? ''))
  if (!fileId) {
    res.status(400).json({ error: 'fileId inválido' })
    return
  }

  const subject = resolveDriveSubject(user)
  const found = await getFileInSharedDrive(fileId, subject)
  if (!found.ok) {
    res.status(found.status).json({ error: found.error })
    return
  }

  if (found.file.trashed) {
    res.status(404).json({ error: 'Archivo no encontrado' })
    return
  }

  if (found.file.mimeType === FOLDER_MIME) {
    res.status(400).json({ error: 'No se puede abrir una carpeta embebida' })
    return
  }

  try {
    const drive = await getDrive(subject)
    const meta = await drive.files.get({
      fileId,
      supportsAllDrives: true,
      fields: 'id, name, mimeType, webViewLink, capabilities/canEdit',
    })

    res.json({
      id: meta.data.id ?? fileId,
      name: meta.data.name ?? fileId,
      mimeType: meta.data.mimeType ?? found.file.mimeType ?? 'application/octet-stream',
      webViewLink: meta.data.webViewLink ?? null,
      canEdit: Boolean(meta.data.capabilities?.canEdit),
    })
  } catch (err) {
    const status = googleStatus(err)
    if (status === 404) {
      res.status(404).json({ error: 'Archivo no encontrado' })
      return
    }
    if (status === 403) {
      res.status(403).json({ error: 'No tenés permiso para acceder a este archivo' })
      return
    }
    logError('Drive files.get (detalle) falló', err)
    const message = googleUserMessage(err)
    res.status(status && status >= 400 && status < 600 ? status : 502).json({
      error: message ?? 'No se pudo leer el archivo',
    })
  }
}
