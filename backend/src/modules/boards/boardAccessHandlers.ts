import type { Request, Response } from 'express'
import { writeAuditLogBestEffort } from '../audit/writeAuditLog.js'
import { logError } from '../../lib/log.js'
import { parseBoardAccessReason } from './accessPolicy.js'
import {
  getBoardAccessRecord,
  grantBoardAccess,
  isSuperAdminUser,
  resolveWorkspaceUserByEmail,
  revokeBoardAccess,
} from './boardAccess.js'
import { boardsFeatureConfigured } from './policy.js'
import { assertDirectBoardFolder, sanitizeBoardFolderId } from './resolveBoardPath.js'

function requireSuperAdminActor(req: Request, res: Response): boolean {
  const user = req.authedUser
  if (!user) {
    res.status(401).json({ error: 'No autenticado' })
    return false
  }
  if (!isSuperAdminUser(user)) {
    res.status(403).json({ error: 'Se requiere rol super_admin' })
    return false
  }
  return true
}

export async function getBoardsVisibility(req: Request, res: Response): Promise<void> {
  const user = req.authedUser
  if (!user) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }
  if (!boardsFeatureConfigured()) {
    res.json({ visible: false })
    return
  }

  if (isSuperAdminUser(user)) {
    res.json({ visible: true })
    return
  }

  const { hasAnyBoardAccess } = await import('./boardAccess.js')
  const visible = await hasAnyBoardAccess(user)
  res.json({ visible })
}

export async function listBoardAccess(req: Request, res: Response): Promise<void> {
  if (!requireSuperAdminActor(req, res)) return

  const boardFolderId = sanitizeBoardFolderId(String(req.params.boardFolderId ?? ''))
  if (!boardFolderId) {
    res.status(400).json({ error: 'boardFolderId inválido' })
    return
  }

  const board = await assertDirectBoardFolder(boardFolderId)
  if (!board.ok) {
    res.status(board.status).json({ error: board.error })
    return
  }

  const record = await getBoardAccessRecord(boardFolderId)
  res.json({
    boardFolderId,
    boardName: board.name,
    allowedUsers: (record?.allowedUsers ?? []).map((row) => ({
      uid: row.uid,
      email: row.email,
      displayName: row.displayName,
      grantedAt: row.grantedAt?.toDate?.()?.toISOString?.() ?? null,
      grantedBy: row.grantedBy,
    })),
  })
}

export async function grantBoardAccessHandler(req: Request, res: Response): Promise<void> {
  if (!requireSuperAdminActor(req, res)) return

  const body = req.body as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Body inválido' })
    return
  }

  const reasonRaw = typeof body.reason === 'string' ? body.reason : ''
  const parsedReason = parseBoardAccessReason(reasonRaw)
  if (!parsedReason.ok) {
    res.status(400).json({ error: parsedReason.error })
    return
  }
  const reason = parsedReason.reason

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!email) {
    res.status(400).json({ error: 'email es obligatorio' })
    return
  }

  const boardFolderId = sanitizeBoardFolderId(String(req.params.boardFolderId ?? ''))
  if (!boardFolderId) {
    res.status(400).json({ error: 'boardFolderId inválido' })
    return
  }

  const board = await assertDirectBoardFolder(boardFolderId)
  if (!board.ok) {
    res.status(board.status).json({ error: board.error })
    return
  }

  const grantee = await resolveWorkspaceUserByEmail(email)
  if (!grantee) {
    res.status(404).json({ error: 'Usuario no encontrado o no habilitado en la intranet' })
    return
  }

  const actor = req.authedUser!
  try {
    const result = await grantBoardAccess({
      boardFolderId,
      boardName: board.name,
      grantee,
      actor,
    })

    if (result.granted) {
      await writeAuditLogBestEffort({
        userId: actor.uid,
        userEmail: actor.email,
        action: 'board_access_grant',
        targetType: 'board',
        targetId: boardFolderId,
        targetName: board.name,
        parentFolderId: null,
        mimeType: null,
        reason,
        metadata: { granteeUid: grantee.uid, granteeEmail: grantee.email },
      })
    }

    res.status(result.granted ? 201 : 200).json({
      granted: result.granted,
      allowedUsers: result.allowedUsers.map((row) => ({
        uid: row.uid,
        email: row.email,
        displayName: row.displayName,
      })),
    })
  } catch (err) {
    logError('board access grant falló', err)
    res.status(500).json({ error: 'No se pudo otorgar acceso al tablero' })
  }
}

export async function revokeBoardAccessHandler(req: Request, res: Response): Promise<void> {
  if (!requireSuperAdminActor(req, res)) return

  const body = req.body as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Body inválido' })
    return
  }

  const reasonRaw = typeof body.reason === 'string' ? body.reason : ''
  const parsedReason = parseBoardAccessReason(reasonRaw)
  if (!parsedReason.ok) {
    res.status(400).json({ error: parsedReason.error })
    return
  }
  const reason = parsedReason.reason

  const boardFolderId = sanitizeBoardFolderId(String(req.params.boardFolderId ?? ''))
  const granteeUid = typeof req.params.uid === 'string' ? req.params.uid.trim() : ''
  if (!boardFolderId || !granteeUid) {
    res.status(400).json({ error: 'boardFolderId o uid inválido' })
    return
  }

  const board = await assertDirectBoardFolder(boardFolderId)
  if (!board.ok) {
    res.status(board.status).json({ error: board.error })
    return
  }

  const actor = req.authedUser!
  try {
    const result = await revokeBoardAccess({
      boardFolderId,
      boardName: board.name,
      granteeUid,
      actor,
    })

    if (!result.revoked) {
      res.status(404).json({
        error:
          result.reason === 'missing_doc'
            ? 'Este tablero no tiene lista de acceso'
            : 'El usuario no estaba en la lista de acceso',
      })
      return
    }

    await writeAuditLogBestEffort({
      userId: actor.uid,
      userEmail: actor.email,
      action: 'board_access_revoke',
      targetType: 'board',
      targetId: boardFolderId,
      targetName: board.name,
      parentFolderId: null,
      mimeType: null,
      reason,
      metadata: { granteeUid: result.grantee.uid, granteeEmail: result.grantee.email },
    })

    res.json({
      revoked: true,
      allowedUsers: result.allowedUsers.map((row) => ({
        uid: row.uid,
        email: row.email,
        displayName: row.displayName,
      })),
    })
  } catch (err) {
    logError('board access revoke falló', err)
    res.status(500).json({ error: 'No se pudo revocar acceso al tablero' })
  }
}
