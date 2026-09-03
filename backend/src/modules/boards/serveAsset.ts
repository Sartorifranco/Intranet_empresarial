import type { Request, Response } from 'express'
import { getDrive } from '../../lib/google/driveClient.js'
import { adminDb } from '../../lib/firebase/admin.js'
import { logError } from '../../lib/log.js'
import { googleStatus, googleUserMessage } from '../drive/assertInSharedDrive.js'
import type { AuthedUser } from '../auth/middleware.js'
import { normalizeActionGrants } from '../drive/governanceActions.js'
import { canViewBoard } from './boardAccess.js'
import { boardsFeatureConfigured } from './policy.js'
import {
  normalizeRelativePath,
  resolveFileInBoardTree,
  sanitizeBoardFolderId,
} from './resolveBoardPath.js'
import { readBoardSession } from './sessionCookie.js'
import {
  boardContentSecurityPolicy,
  contentTypeForBoardFile,
  isAllowedBoardMime,
} from './mimePolicy.js'

function extractRelativePath(req: Request, boardFolderId: string): string | null {
  const wildcard = req.params[0]
  if (typeof wildcard === 'string' && wildcard.length > 0) {
    return normalizeRelativePath(wildcard)
  }
  const prefix = `/${boardFolderId}/`
  if (req.path.startsWith(prefix)) {
    return normalizeRelativePath(req.path.slice(prefix.length))
  }
  if (req.path === `/${boardFolderId}` || req.path === `/${boardFolderId}/`) {
    return 'index.html'
  }
  return normalizeRelativePath('index.html')
}

async function authedUserFromBoardSession(
  session: { uid: string; email: string },
): Promise<AuthedUser | null> {
  const profile = await adminDb().collection('users').doc(session.uid).get()
  if (!profile.exists) return null
  const role = profile.get('role')
  const permissionsRaw = profile.get('permissions')
  const permissions =
    permissionsRaw && typeof permissionsRaw === 'object' && !Array.isArray(permissionsRaw)
      ? {
          super_admin:
            (permissionsRaw as Record<string, unknown>).super_admin === true,
          view_drive: (permissionsRaw as Record<string, unknown>).view_drive === true,
        }
      : {}
  const managedRaw = profile.get('managedAreaIds')
  const managedAreaIds = Array.isArray(managedRaw)
    ? managedRaw.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  return {
    uid: session.uid,
    email: session.email,
    displayName:
      (typeof profile.get('displayName') === 'string' && profile.get('displayName').trim()) ||
      session.email,
    role: typeof role === 'string' ? role : undefined,
    managedAreaIds,
    actionGrants: normalizeActionGrants(profile.get('actionGrants')),
    permissions,
  }
}

export async function serveBoardAsset(req: Request, res: Response): Promise<void> {
  if (!boardsFeatureConfigured()) {
    res.status(503).json({ error: 'Tableros no configurados' })
    return
  }

  const session = readBoardSession(req)
  if (!session) {
    res.status(401).json({ error: 'Sesión de tableros requerida' })
    return
  }

  const viewer = await authedUserFromBoardSession(session)
  if (!viewer) {
    res.status(403).json({ error: 'Usuario de sesión no habilitado' })
    return
  }

  const boardFolderId = sanitizeBoardFolderId(String(req.params.boardFolderId ?? ''))
  if (!boardFolderId) {
    res.status(400).json({ error: 'boardFolderId inválido' })
    return
  }

  const allowed = await canViewBoard(viewer, boardFolderId)
  if (!allowed) {
    res.status(403).json({ error: 'No tenés permiso para ver este tablero' })
    return
  }

  const relativePath = extractRelativePath(req, boardFolderId)
  if (!relativePath) {
    res.status(400).json({ error: 'Ruta inválida' })
    return
  }

  const resolved = await resolveFileInBoardTree(boardFolderId, relativePath)
  if (!resolved.ok) {
    res.status(resolved.status).json({ error: resolved.error })
    return
  }

  const contentType = contentTypeForBoardFile(resolved.name, resolved.mimeType)
  if (!isAllowedBoardMime(contentType)) {
    res.status(403).json({ error: 'Tipo de archivo no permitido en tableros' })
    return
  }

  try {
    const drive = await getDrive()
    const media = await drive.files.get(
      { fileId: resolved.fileId, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream' },
    )

    res.setHeader('Content-Type', contentType!)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'private, max-age=300')
    if (contentType!.startsWith('text/html')) {
      res.setHeader('Content-Security-Policy', boardContentSecurityPolicy())
      res.setHeader('Content-Disposition', 'inline')
    }

    media.data
      .on('error', (err) => {
        logError('Stream de tablero falló', err)
        if (!res.headersSent) res.status(502).end()
      })
      .pipe(res)
  } catch (err) {
    logError('Drive files.get (board asset) falló', err)
    const status = googleStatus(err)
    res.status(status === 404 ? 404 : 502).json({
      error: status === 404 ? 'Archivo no encontrado' : 'No se pudo leer el archivo del tablero',
      ...(googleUserMessage(err) ? { detail: googleUserMessage(err) } : {}),
    })
  }
}
