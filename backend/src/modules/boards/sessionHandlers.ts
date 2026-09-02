import type { Request, Response } from 'express'
import { writeAuditLogBestEffort } from '../audit/writeAuditLog.js'
import { canViewBoard, hasAnyBoardAccess } from './boardAccess.js'
import { boardsFeatureConfigured } from './policy.js'
import { assertDirectBoardFolder, sanitizeBoardFolderId } from './resolveBoardPath.js'
import { setBoardSessionCookie } from './sessionCookie.js'

export async function createBoardSession(req: Request, res: Response): Promise<void> {
  const user = req.authedUser
  if (!user) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }
  if (!boardsFeatureConfigured()) {
    res.status(503).json({ error: 'Tableros no configurados' })
    return
  }
  if (!(await hasAnyBoardAccess(user))) {
    res.status(403).json({ error: 'No tenés permiso para ver tableros' })
    return
  }

  setBoardSessionCookie(res, user.uid, user.email)
  res.json({ ok: true, expiresInSec: 60 * 60 })
}

export async function recordBoardOpen(req: Request, res: Response): Promise<void> {
  const user = req.authedUser
  if (!user) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }

  const boardFolderId = sanitizeBoardFolderId(String(req.params.boardFolderId ?? ''))
  if (!boardFolderId) {
    res.status(400).json({ error: 'boardFolderId inválido' })
    return
  }

  if (!(await canViewBoard(user, boardFolderId))) {
    res.status(403).json({ error: 'No tenés permiso para ver este tablero' })
    return
  }

  const board = await assertDirectBoardFolder(boardFolderId)
  if (!board.ok) {
    res.status(board.status).json({ error: board.error })
    return
  }

  await writeAuditLogBestEffort({
    userId: user.uid,
    userEmail: user.email,
    action: 'board_view',
    targetType: 'board',
    targetId: boardFolderId,
    targetName: board.name,
    parentFolderId: null,
    mimeType: 'text/html',
    reason: null,
    metadata: { entryPath: 'index.html' },
  })

  res.json({ id: boardFolderId, name: board.name })
}
