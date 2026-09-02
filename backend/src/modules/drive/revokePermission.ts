import type { Request, Response } from 'express'
import { getDrive } from '../../lib/google/driveClient.js'
import { sanitizeDriveId } from '../../lib/google/driveIds.js'
import { logError } from '../../lib/log.js'
import { writeAuditLogBestEffort } from '../audit/writeAuditLog.js'
import { getFileInSharedDrive, googleStatus, googleUserMessage } from './assertInSharedDrive.js'
import {
  canGovernDriveFile,
  GOVERN_DRIVE_FORBIDDEN,
  resolveFileGoverningAreaId,
} from './governDriveFile.js'
import { getMinReasonLength } from './policy.js'

export async function revokeDrivePermission(req: Request, res: Response): Promise<void> {
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

  const reason = typeof body.reason === 'string' ? body.reason : ''
  const minReason = await getMinReasonLength()
  if (reason.trim().length < minReason) {
    res.status(400).json({
      error: `reason debe tener al menos ${minReason} caracteres`,
    })
    return
  }

  const fileId = sanitizeDriveId(String(req.params.fileId ?? ''))
  const permissionId = sanitizeDriveId(String(req.params.permissionId ?? ''))
  if (!fileId) {
    res.status(400).json({ error: 'fileId inválido' })
    return
  }
  if (!permissionId) {
    res.status(400).json({ error: 'permissionId inválido' })
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

  const drive = await getDrive()
  let granteeEmail: string | null = null
  let role: string | null = null
  let permType: string | null = null

  try {
    const perm = await drive.permissions.get({
      fileId,
      permissionId,
      supportsAllDrives: true,
      fields: 'id, type, role, emailAddress, domain',
    })
    granteeEmail = perm.data.emailAddress ?? perm.data.domain ?? null
    role = perm.data.role ?? null
    permType = perm.data.type ?? null
  } catch (err) {
    const status = googleStatus(err)
    if (status === 404) {
      res.status(404).json({ error: 'Permiso no encontrado' })
      return
    }
    logError('Drive permissions.get falló', err)
    res.status(502).json({ error: 'No se pudo leer el permiso' })
    return
  }

  try {
    await drive.permissions.delete({
      fileId,
      permissionId,
      supportsAllDrives: true,
      enforceExpansiveAccess: true,
    })
  } catch (err) {
    logError('Drive permissions.delete falló', err)
    const detail = googleUserMessage(err)
    res.status(502).json({
      error: 'No se pudo revocar el permiso',
      ...(detail ? { detail } : {}),
    })
    return
  }

  await writeAuditLogBestEffort({
    userId: user.uid,
    userEmail: user.email,
    action: 'permission_revoke',
    targetType: 'file',
    targetId: fileId,
    targetName: found.file.name,
    parentFolderId: found.file.parentFolderId,
    mimeType: found.file.mimeType,
    reason: reason.trim(),
    metadata: {
      granteeEmail,
      role,
      permissionId,
      type: permType,
    },
  })

  res.json({ id: permissionId, revoked: true })
}
