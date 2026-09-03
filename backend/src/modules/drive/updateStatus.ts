import type { Request, Response } from 'express'
import { sanitizeDriveId } from '../../lib/google/driveIds.js'
import { writeAuditLogBestEffort } from '../audit/writeAuditLog.js'
import { getFileInSharedDrive } from './assertInSharedDrive.js'
import { getStoredStatus, writeFileStatus } from './classification.js'
import {
  canPerformGovernanceAction,
  governanceForbiddenMessage,
  resolveFileGoverningAreaId,
} from './governDriveFile.js'
import { invalidateDriveMetadataForUser } from './driveMetadataCache.js'
import { resolveDriveSubject } from './driveSubject.js'
import { getMinReasonLength } from './policy.js'

export async function updateDriveFileStatus(req: Request, res: Response): Promise<void> {
  const user = req.authedUser
  if (!user) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }

  const body = req.body as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Body inválido' })
    return
  }

  if (body.status !== 'APROBADO') {
    res.status(400).json({ error: "status debe ser 'APROBADO' (no hay vuelta a BORRADOR)" })
    return
  }

  const reason = typeof body.reason === 'string' ? body.reason : ''
  const minReason = await getMinReasonLength()
  if (reason.trim().length < minReason) {
    res.status(400).json({
      error: `reason debe tener al menos ${minReason} caracteres`,
    })
    return
  }

  const fileId = sanitizeDriveId(String(req.params.fileId ?? ''))
  if (!fileId) {
    res.status(400).json({ error: 'fileId inválido' })
    return
  }

  const found = await getFileInSharedDrive(fileId)
  if (!found.ok) {
    res.status(found.status).json({ error: found.error })
    return
  }

  const governingAreaId = await resolveFileGoverningAreaId(fileId, found.file.parentFolderId)

  if (!canPerformGovernanceAction(user, 'approval', governingAreaId)) {
    res.status(403).json({ error: governanceForbiddenMessage('approval') })
    return
  }

  const previousStatus = await getStoredStatus(fileId)
  if (previousStatus === 'APROBADO') {
    res.status(409).json({ error: 'El archivo ya está aprobado' })
    return
  }

  try {
    await writeFileStatus(fileId, 'APROBADO', { uid: user.uid, email: user.email })
  } catch {
    res.status(502).json({ error: 'No se pudo guardar el estado' })
    return
  }

  await writeAuditLogBestEffort({
    userId: user.uid,
    userEmail: user.email,
    action: 'approval',
    targetType: 'file',
    targetId: fileId,
    targetName: found.file.name,
    parentFolderId: found.file.parentFolderId,
    mimeType: found.file.mimeType,
    reason: reason.trim(),
    metadata: {
      previousStatus,
      status: 'APROBADO',
      governingAreaId: governingAreaId ?? null,
    },
  })

  invalidateDriveMetadataForUser(resolveDriveSubject(user), user.uid)
  res.json({
    id: fileId,
    status: 'APROBADO',
    previousStatus,
    governingAreaId: governingAreaId ?? null,
  })
}
