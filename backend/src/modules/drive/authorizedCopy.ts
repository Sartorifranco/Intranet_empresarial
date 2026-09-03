import type { Request, Response } from 'express'
import { getDrive } from '../../lib/google/driveClient.js'
import { sanitizeDriveId } from '../../lib/google/driveIds.js'
import { getSharedDriveRootId } from '../../lib/google/sharedDrive.js'
import { logError } from '../../lib/log.js'
import { writeAuditLogBestEffort } from '../audit/writeAuditLog.js'
import { getFileInSharedDrive, googleUserMessage } from './assertInSharedDrive.js'
import {
  getStoredClassification,
  permissionCreateDeniedReason,
  writeFileClassificationBestEffort,
} from './classification.js'
import {
  canPerformGovernanceAction,
  governanceForbiddenMessage,
  resolveFileGoverningAreaId,
} from './governDriveFile.js'
import { getMinReasonLength } from './policy.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function createAuthorizedCopy(req: Request, res: Response): Promise<void> {
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

  const recipientName = typeof body.recipientName === 'string' ? body.recipientName.trim() : ''
  if (!recipientName) {
    res.status(400).json({ error: 'recipientName es obligatorio' })
    return
  }

  const purpose = typeof body.purpose === 'string' ? body.purpose : ''
  const reason = typeof body.reason === 'string' ? body.reason : ''
  const minReason = await getMinReasonLength()
  if (purpose.trim().length < minReason) {
    res.status(400).json({
      error: `purpose debe tener al menos ${minReason} caracteres`,
    })
    return
  }
  if (reason.trim().length < minReason) {
    res.status(400).json({
      error: `reason debe tener al menos ${minReason} caracteres`,
    })
    return
  }

  let recipientEmail: string | null = null
  if (body.recipientEmail !== undefined && body.recipientEmail !== null && body.recipientEmail !== '') {
    const raw = typeof body.recipientEmail === 'string' ? body.recipientEmail.trim().toLowerCase() : ''
    if (!EMAIL_RE.test(raw)) {
      res.status(400).json({ error: 'recipientEmail inválido' })
      return
    }
    recipientEmail = raw
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
  if (found.file.trashed) {
    res.status(409).json({ error: 'El archivo está en la papelera' })
    return
  }

  const governingAreaId = await resolveFileGoverningAreaId(fileId, found.file.parentFolderId)
  if (!canPerformGovernanceAction(user, 'authorized_copy', governingAreaId)) {
    res.status(403).json({ error: governanceForbiddenMessage('authorized_copy') })
    return
  }

  const classification = await getStoredClassification(fileId)
  const parentId = found.file.parentFolderId ?? getSharedDriveRootId()
  const copyName = `${found.file.name} — copia para ${recipientName}`.slice(0, 255)

  let copyId = ''
  let copyNameOut = copyName
  let webViewLink: string | null = null
  let copyMime: string | null = found.file.mimeType

  try {
    const drive = await getDrive()
    const copied = await drive.files.copy({
      fileId,
      requestBody: {
        name: copyName,
        parents: [parentId],
      },
      supportsAllDrives: true,
      fields: 'id, name, mimeType, webViewLink, parents',
    })

    copyId = copied.data.id ?? ''
    copyNameOut = copied.data.name ?? copyName
    webViewLink = copied.data.webViewLink ?? null
    copyMime = copied.data.mimeType ?? found.file.mimeType

    await writeFileClassificationBestEffort(
      copyId,
      classification,
      { uid: user.uid, email: user.email },
      { status: 'BORRADOR' },
    )

    let copyPermissionId: string | null = null
    let recipientShareError: string | null = null
    if (recipientEmail) {
      // Copia autorizada: type user sobre la COPIA (no el original).
      // La clasificación no bloquea user; acá el email puede ser externo.
      const denied = permissionCreateDeniedReason(classification, 'user')
      if (denied) {
        recipientShareError = denied
      } else {
        try {
          const perm = await drive.permissions.create({
            fileId: copyId,
            requestBody: {
              type: 'user',
              role: 'reader',
              emailAddress: recipientEmail,
            },
            sendNotificationEmail: true,
            supportsAllDrives: true,
            enforceExpansiveAccess: true,
            fields: 'id',
          })
          copyPermissionId = perm.data.id ?? null
        } catch (shareErr) {
          logError('Drive permissions.create (authorized-copy destinatario) falló', shareErr)
          recipientShareError =
            googleUserMessage(shareErr) ?? 'No se pudo compartir la copia con el destinatario'
        }
      }
    }

    await writeAuditLogBestEffort({
      userId: user.uid,
      userEmail: user.email,
      action: 'authorized_copy',
      targetType: 'file',
      targetId: fileId,
      targetName: found.file.name,
      parentFolderId: found.file.parentFolderId,
      mimeType: found.file.mimeType,
      reason: reason.trim(),
      metadata: {
        recipientName,
        recipientEmail,
        purpose: purpose.trim(),
        sourceFileId: fileId,
        copyFileId: copyId,
        copyPermissionId,
        recipientShareError,
        classification,
      },
    })

    res.status(201).json({
      id: copyId,
      name: copyNameOut,
      mimeType: copyMime,
      webViewLink,
      sourceFileId: fileId,
      classification,
      recipientPermissionId: copyPermissionId,
      recipientShareError,
    })
  } catch (err) {
    logError('Drive files.copy (authorized-copy) falló', err)
    res.status(502).json({ error: 'No se pudo crear la copia autorizada' })
  }
}
