import { randomUUID } from 'node:crypto'
import type { Request, Response } from 'express'
import { getDrive } from '../../lib/google/driveClient.js'
import { sanitizeDriveId } from '../../lib/google/driveIds.js'
import { logError } from '../../lib/log.js'
import { writeAuditLogBestEffort } from '../audit/writeAuditLog.js'
import { getFileInSharedDrive, googleUserMessage } from './assertInSharedDrive.js'
import {
  canPerformGovernanceAction,
  governanceForbiddenMessage,
  resolveFileGoverningAreaId,
} from './governDriveFile.js'
import { grantUserDrivePermission, isPermissionRole } from './driveUserPermission.js'
import { getMinReasonLength } from './policy.js'
import { getAreaDisplayName, resolveAreaMembers } from './resolveAreaMembers.js'

export async function grantDriveAreaPermission(req: Request, res: Response): Promise<void> {
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

  if (!isPermissionRole(body.role)) {
    res.status(400).json({ error: "role debe ser 'reader', 'writer' o 'commenter'" })
    return
  }
  const role = body.role

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
  if (!governingAreaId) {
    res.status(400).json({ error: 'El archivo no tiene área gobernante asignada' })
    return
  }

  if (!canPerformGovernanceAction(user, 'permission_grant', governingAreaId)) {
    res.status(403).json({ error: governanceForbiddenMessage('permission_grant') })
    return
  }

  const members = await resolveAreaMembers(governingAreaId)
  if (members.length === 0) {
    res.status(409).json({
      error: 'No hay usuarios registrados en el área gobernante de este archivo',
      governingAreaId,
    })
    return
  }

  const areaName = (await getAreaDisplayName(governingAreaId)) ?? governingAreaId
  const batchId = randomUUID()
  const drive = await getDrive()
  const trimmedReason = reason.trim()

  const granted: Array<{
    uid: string
    email: string
    permissionId: string
  }> = []
  const failures: Array<{ uid: string; email: string; error: string }> = []

  for (const member of members) {
    try {
      const result = await grantUserDrivePermission(drive, fileId, member.email, role, {
        sendNotificationEmail: true,
      })

      await writeAuditLogBestEffort({
        userId: user.uid,
        userEmail: user.email,
        action: 'permission_grant',
        targetType: 'file',
        targetId: fileId,
        targetName: found.file.name,
        parentFolderId: found.file.parentFolderId,
        mimeType: found.file.mimeType,
        reason: trimmedReason,
        metadata: {
          granteeEmail: member.email,
          granteeUid: member.uid,
          role,
          driveRole: result.driveRole,
          permissionId: result.permissionId,
          type: 'user',
          areaFanOut: {
            batchId,
            governingAreaId,
            areaName,
          },
        },
      })

      granted.push({
        uid: member.uid,
        email: member.email,
        permissionId: result.permissionId,
      })
    } catch (err) {
      logError('Drive area fan-out grant falló para un miembro', err)
      failures.push({
        uid: member.uid,
        email: member.email,
        error: googleUserMessage(err) ?? 'No se pudo otorgar el permiso',
      })
    }
  }

  if (granted.length === 0) {
    res.status(502).json({
      error: 'No se pudo otorgar el permiso a ningún miembro del área',
      governingAreaId,
      areaName,
      batchId,
      failures,
    })
    return
  }

  const status = failures.length > 0 ? 207 : 201
  res.status(status).json({
    batchId,
    governingAreaId,
    areaName,
    role,
    grantedCount: granted.length,
    failedCount: failures.length,
    granted,
    failures,
  })
}
