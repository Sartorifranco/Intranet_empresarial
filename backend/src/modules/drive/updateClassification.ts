import type { Request, Response } from 'express'
import { sanitizeDriveId } from '../../lib/google/driveIds.js'
import { writeAuditLogBestEffort } from '../audit/writeAuditLog.js'
import { getFileInSharedDrive } from './assertInSharedDrive.js'
import {
  getStoredClassification,
  parseClassificationInput,
  writeFileClassification,
} from './classification.js'
import {
  canGovernDriveFile,
  GOVERN_DRIVE_FORBIDDEN,
  resolveFileGoverningAreaId,
} from './governDriveFile.js'
import { invalidateDriveMetadataForUser } from './driveMetadataCache.js'
import { resolveDriveSubject } from './driveSubject.js'
import { getMinReasonLength } from './policy.js'

export async function updateDriveFileClassification(req: Request, res: Response): Promise<void> {
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

  const parsed = parseClassificationInput(body.classification)
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error })
    return
  }
  if (body.classification === undefined || body.classification === null) {
    res.status(400).json({ error: 'classification es obligatorio' })
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
  if (!canGovernDriveFile(user, governingAreaId)) {
    res.status(403).json({ error: GOVERN_DRIVE_FORBIDDEN })
    return
  }

  const previousClassification = await getStoredClassification(fileId)
  const classification = parsed.classification

  try {
    await writeFileClassification(fileId, classification, {
      uid: user.uid,
      email: user.email,
    })
  } catch {
    res.status(502).json({ error: 'No se pudo guardar la clasificación' })
    return
  }

  await writeAuditLogBestEffort({
    userId: user.uid,
    userEmail: user.email,
    action: 'classification_change',
    targetType: 'file',
    targetId: fileId,
    targetName: found.file.name,
    parentFolderId: found.file.parentFolderId,
    mimeType: found.file.mimeType,
    reason: reason.trim(),
    metadata: {
      previousClassification,
      classification,
      governingAreaId,
    },
  })

  invalidateDriveMetadataForUser(resolveDriveSubject(user), user.uid)
  res.json({
    id: fileId,
    classification,
    previousClassification,
  })
}
