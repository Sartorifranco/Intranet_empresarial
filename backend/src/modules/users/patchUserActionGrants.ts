import type { Request, Response } from 'express'
import { adminDb } from '../../lib/firebase/admin.js'
import { logError } from '../../lib/log.js'
import { writeAuditLogBestEffort } from '../audit/writeAuditLog.js'
import { getMinReasonLength } from '../drive/policy.js'
import {
  isGovernanceAction,
  type ActionGrants,
  type GovernanceAction,
} from '../drive/governanceActions.js'
import { getAreaDisplayName } from '../drive/resolveAreaMembers.js'
import { loadTargetUser, parseReason, USERS_COLLECTION, validateAssignableAreaIds } from './userGovernanceShared.js'

function grantsForAction(grants: ActionGrants, action: GovernanceAction): string[] {
  return [...(grants[action] ?? [])]
}

function setGrantAreas(
  grants: ActionGrants,
  action: GovernanceAction,
  areaIds: string[],
): ActionGrants {
  const next: ActionGrants = { ...grants }
  if (areaIds.length === 0) {
    delete next[action]
  } else {
    next[action] = areaIds
  }
  return next
}

/** PATCH /api/users/:uid/action-grants — grant/revoke puntual (super_admin). */
export async function patchUserActionGrants(req: Request, res: Response): Promise<void> {
  const actor = req.authedUser
  if (!actor) {
    res.status(401).json({ error: 'No autenticado' })
    return
  }

  const uid = String(req.params.uid ?? '').trim()
  if (!uid) {
    res.status(400).json({ error: 'uid inválido' })
    return
  }

  const body = req.body as Record<string, unknown> | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Body inválido' })
    return
  }

  const minReason = await getMinReasonLength()
  const reason = parseReason(body, minReason)
  if (!reason) {
    res.status(400).json({ error: `reason debe tener al menos ${minReason} caracteres` })
    return
  }

  if (!isGovernanceAction(body.action)) {
    res.status(400).json({ error: 'action inválida' })
    return
  }
  const action = body.action

  const operation = body.operation
  if (operation !== 'grant' && operation !== 'revoke') {
    res.status(400).json({ error: "operation debe ser 'grant' o 'revoke'" })
    return
  }

  const areaId = typeof body.areaId === 'string' ? body.areaId.trim() : ''
  if (!areaId) {
    res.status(400).json({ error: 'areaId inválido' })
    return
  }

  let target
  try {
    const loaded = await loadTargetUser(uid)
    if (!loaded) {
      res.status(404).json({ error: 'Usuario no encontrado' })
      return
    }
    target = loaded
  } catch (err) {
    logError('patchUserActionGrants: fallo al cargar usuario', err)
    res.status(500).json({ error: 'No se pudo cargar el usuario' })
    return
  }

  if (target.role === 'super_admin') {
    res.status(409).json({ error: 'No se asignan excepciones a super_admin' })
    return
  }

  let validatedAreaIds: string[]
  try {
    validatedAreaIds = await validateAssignableAreaIds([areaId])
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'areaId inválido',
    })
    return
  }
  const validatedAreaId = validatedAreaIds[0]

  if (target.managedAreaIds.includes(validatedAreaId)) {
    res.status(409).json({
      error: 'El usuario ya gobierna esta área (managedAreaIds); la excepción es redundante',
    })
    return
  }

  const before = grantsForAction(target.actionGrants, action)
  const beforeSet = new Set(before)

  if (operation === 'grant') {
    if (beforeSet.has(validatedAreaId)) {
      res.status(409).json({ error: 'La excepción ya existe' })
      return
    }
    beforeSet.add(validatedAreaId)
  } else {
    if (!beforeSet.has(validatedAreaId)) {
      res.status(409).json({ error: 'La excepción no existe' })
      return
    }
    beforeSet.delete(validatedAreaId)
  }

  const after = [...beforeSet].sort()
  const nextGrants = setGrantAreas(target.actionGrants, action, after)

  try {
    await adminDb().collection(USERS_COLLECTION).doc(uid).update({
      actionGrants: nextGrants,
    })
  } catch (err) {
    logError('patchUserActionGrants: fallo al actualizar Firestore', err)
    res.status(500).json({ error: 'No se pudo guardar la excepción' })
    return
  }

  const areaName = await getAreaDisplayName(validatedAreaId)

  await writeAuditLogBestEffort({
    userId: actor.uid,
    userEmail: actor.email,
    action: 'action_grants_change',
    targetType: 'user',
    targetId: uid,
    targetName: target.targetName,
    parentFolderId: null,
    mimeType: null,
    reason,
    metadata: {
      governanceAction: action,
      areaId: validatedAreaId,
      areaName,
      operation,
      antes: before,
      despues: after,
    },
  })

  res.json({
    uid,
    actionGrants: nextGrants,
    governanceAction: action,
    areaId: validatedAreaId,
    operation,
  })
}
