import type { Request, Response } from 'express'
import { getDrive } from '../../lib/google/driveClient.js'
import { sanitizeDriveId } from '../../lib/google/driveIds.js'
import { getSharedDriveRootId } from '../../lib/google/sharedDrive.js'
import { logError } from '../../lib/log.js'
import { writeAuditLogBestEffort } from '../audit/writeAuditLog.js'
import { googleStatus, googleUserMessage } from './assertInSharedDrive.js'
import {
  DEFAULT_CLASSIFICATION,
  parseClassificationInput,
  type FileClassification,
  writeFileClassificationBestEffort,
  writeFolderSidecarBestEffort,
} from './classification.js'
import { invalidateDriveMetadataForUser } from './driveMetadataCache.js'
import { resolveDriveSubject } from './driveSubject.js'
import { getAllowedUploadMimeTypes, getMinReasonLength } from './policy.js'
import { resolveGoverningAreaId } from './resolveGoverningArea.js'

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'
const GOOGLE_SHEET_MIME = 'application/vnd.google-apps.spreadsheet'

const CREATE_TYPES = ['google_doc', 'google_sheet', 'upload', 'folder'] as const
type CreateType = (typeof CREATE_TYPES)[number]

function isCreateType(value: unknown): value is CreateType {
  return typeof value === 'string' && (CREATE_TYPES as readonly string[]).includes(value)
}

function resolveCreateMime(type: CreateType, uploadMime: string | undefined): string | null {
  if (type === 'google_doc') return GOOGLE_DOC_MIME
  if (type === 'google_sheet') return GOOGLE_SHEET_MIME
  if (type === 'folder') return FOLDER_MIME
  if (typeof uploadMime === 'string' && uploadMime.trim().length > 0) {
    return uploadMime.trim()
  }
  return null
}

async function assertParentInSharedDrive(
  parentFolderId: string,
  subject: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const driveId = getSharedDriveRootId()

  try {
    const drive = await getDrive(subject)
    const meta = await drive.files.get({
      fileId: parentFolderId,
      supportsAllDrives: true,
      fields: 'id, mimeType, driveId, trashed',
    })

    if (meta.data.trashed) {
      return { ok: false, status: 400, error: 'La carpeta destino está en la papelera' }
    }

    const parentDriveId = meta.data.driveId ?? (parentFolderId === driveId ? driveId : null)
    if (parentDriveId !== driveId) {
      return { ok: false, status: 400, error: 'parentFolderId no pertenece a la Unidad compartida' }
    }

    const isFolder = meta.data.mimeType === FOLDER_MIME
    const isDriveRoot = parentFolderId === driveId
    if (!isFolder && !isDriveRoot) {
      return { ok: false, status: 400, error: 'parentFolderId no es una carpeta' }
    }

    return { ok: true }
  } catch (err) {
    const status = googleStatus(err)
    if (status === 404) {
      return { ok: false, status: 404, error: 'Carpeta destino no encontrada o sin acceso' }
    }
    if (status === 403) {
      return { ok: false, status: 403, error: 'No tenés permiso para usar la carpeta destino' }
    }
    logError('Drive files.get (parent) falló', err)
    return { ok: false, status: 502, error: 'No se pudo validar la carpeta destino' }
  }
}

export async function createDriveFile(req: Request, res: Response): Promise<void> {
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

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) {
    res.status(400).json({ error: 'name es obligatorio' })
    return
  }
  if (!isCreateType(body.type)) {
    res.status(400).json({
      error: "type debe ser 'google_doc', 'google_sheet', 'upload' o 'folder'",
    })
    return
  }
  const type = body.type
  const reason = typeof body.reason === 'string' ? body.reason : ''
  const parentRaw = typeof body.parentFolderId === 'string' ? body.parentFolderId : ''
  const uploadMime = typeof body.mimeType === 'string' ? body.mimeType : undefined
  const isFolderCreate = type === 'folder'

  let classification: FileClassification = DEFAULT_CLASSIFICATION

  if (!isFolderCreate) {
    const parsedClass = parseClassificationInput(body.classification)
    if (!parsedClass.ok) {
      res.status(400).json({ error: parsedClass.error })
      return
    }
    classification = parsedClass.classification
  }

  const minReason = await getMinReasonLength()
  if (reason.trim().length < minReason) {
    res.status(400).json({
      error: `reason debe tener al menos ${minReason} caracteres`,
    })
    return
  }

  const parentFolderId = sanitizeDriveId(parentRaw)
  if (!parentFolderId) {
    res.status(400).json({ error: 'parentFolderId inválido' })
    return
  }

  let mimeType: string
  if (type === 'upload') {
    const allowed = await getAllowedUploadMimeTypes()
    const candidate = resolveCreateMime(type, uploadMime)
    if (!candidate || !allowed.includes(candidate)) {
      res.status(403).json({
        error: 'mimeType no permitido para upload',
        allowedMimeTypes: allowed,
      })
      return
    }
    mimeType = candidate
  } else {
    const resolved = resolveCreateMime(type, undefined)
    if (!resolved) {
      res.status(400).json({ error: 'No se pudo resolver mimeType para el tipo solicitado' })
      return
    }
    mimeType = resolved
  }

  const driveSubject = resolveDriveSubject(user)
  const parentCheck = await assertParentInSharedDrive(parentFolderId, driveSubject)
  if (!parentCheck.ok) {
    res.status(parentCheck.status).json({ error: parentCheck.error })
    return
  }

  try {
    const drive = await getDrive(driveSubject)
    const created = await drive.files.create({
      requestBody: {
        name,
        mimeType,
        parents: [parentFolderId],
      },
      fields: 'id, name, mimeType, webViewLink',
      supportsAllDrives: true,
    })

    const id = created.data.id ?? ''
    const fileName = created.data.name ?? name
    const createdMime = created.data.mimeType ?? mimeType
    const webViewLink = created.data.webViewLink ?? null

    const governingAreaId = await resolveGoverningAreaId(parentFolderId)

    if (isFolderCreate) {
      await writeFolderSidecarBestEffort(
        id,
        { uid: user.uid, email: user.email, displayName: user.displayName },
        { governingAreaId },
      )

      await writeAuditLogBestEffort({
        userId: user.uid,
        userEmail: user.email,
        action: 'create',
        targetType: 'folder',
        targetId: id,
        targetName: fileName,
        parentFolderId,
        mimeType: createdMime,
        reason: reason.trim(),
        metadata: { type, governingAreaId },
      })

      invalidateDriveMetadataForUser(resolveDriveSubject(user), user.uid)
      res.status(201).json({
        id,
        name: fileName,
        mimeType: createdMime,
        webViewLink,
        isFolder: true,
        classification: null,
        status: null,
        governingAreaId,
        createdBy: {
          userId: user.uid,
          email: user.email,
          displayName: user.displayName,
          source: 'intranet',
        },
      })
      return
    }

    await writeFileClassificationBestEffort(
      id,
      classification,
      { uid: user.uid, email: user.email },
      {
        status: 'BORRADOR',
        governingAreaId,
        createdByUserId: user.uid,
        createdByEmail: user.email,
        createdByDisplayName: user.displayName,
      },
    )

    await writeAuditLogBestEffort({
      userId: user.uid,
      userEmail: user.email,
      action: 'create',
      targetType: 'file',
      targetId: id,
      targetName: fileName,
      parentFolderId,
      mimeType: createdMime,
      reason: reason.trim(),
      metadata: { type, classification, status: 'BORRADOR', governingAreaId },
    })

    invalidateDriveMetadataForUser(resolveDriveSubject(user), user.uid)
    res.status(201).json({
      id,
      name: fileName,
      mimeType: createdMime,
      webViewLink,
      classification,
      status: 'BORRADOR',
      governingAreaId,
      createdBy: {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName,
        source: 'intranet',
      },
    })
  } catch (err) {
    logError('Drive files.create falló', err)
    const status = googleStatus(err)
    const detail = googleUserMessage(err)
    res.status(status === 403 || status === 404 ? status : 502).json({
      error:
        status === 403
          ? 'No tenés permiso para crear en esta carpeta'
          : status === 404
            ? 'Carpeta destino no encontrada o sin acceso'
            : isFolderCreate
              ? 'No se pudo crear la carpeta en Drive'
              : 'No se pudo crear el archivo en Drive',
      ...(detail ? { detail } : {}),
    })
  }
}
