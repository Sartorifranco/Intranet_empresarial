/**
 * E2E: un mismo archivo recorre create → sidecar → approve → grant → audit → revoke → audit.
 *
 *   npm run test:e2e:drive
 *
 * La clasificación al crear se guarda en driveFiles y en metadata del log `create`.
 * NO hay `classification_change` en ese alta (esa acción es solo el PATCH de clasificación).
 */

import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const PARENT = '1xSy-TSp4EFeqYJ2n772X46Pj5WM42WZ5'
const GRANTEE = 'implementaciones.ti@bacarsa.com.ar'

const REASON_CREATE = 'E2E: alta de Doc CONFIDENCIAL en _pruebas para la secuencia completa'
const REASON_APPROVE = 'E2E: aprobacion del documento de prueba de extremo a extremo'
const REASON_GRANT = 'E2E: otorgar lectura a un usuario interno de prueba Bacarsa'
const REASON_REVOKE = 'E2E: revocar el permiso interno otorgado en esta misma secuencia'

function apiBase() {
  return (
    process.env.FUNCTIONS_API_BASE?.trim() ||
    'http://127.0.0.1:5001/bacar-web/southamerica-east1/api'
  )
}

async function api(idToken, method, path, body) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let parsed = text
  try {
    parsed = JSON.parse(text)
  } catch {
    // HTML
  }
  return { status: res.status, body: parsed }
}

function chrono(logs) {
  return [...logs].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
}

function actionIndex(logs, action) {
  return chrono(logs).findIndex((l) => l.action === action)
}

async function sidecar(fileId) {
  const snap = await getAdminDb().collection('driveFiles').doc(fileId).get()
  if (!snap.exists) return null
  return { classification: snap.get('classification'), status: snap.get('status') }
}

async function auditByTarget(idToken, fileId) {
  const qs = new URLSearchParams({
    filterBy: 'targetId',
    value: fileId,
    pageSize: '100',
  })
  return api(idToken, 'GET', `/api/audit/logs?${qs}`)
}

function stepLine(ok, label, detail) {
  return `${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`
}

async function main() {
  const { uid, email, idToken } = await getTestIdToken()
  const results = []
  let fileId = null
  let permissionId = null

  console.log(`Actor: ${email} (${uid})`)
  console.log(`Grantee: ${GRANTEE}`)
  console.log('')

  // 1. Create
  const created = await api(idToken, 'POST', '/api/drive/files', {
    name: `E2E politica de datos ${Date.now()}`,
    type: 'google_doc',
    parentFolderId: PARENT,
    reason: REASON_CREATE,
    classification: 'CONFIDENCIAL',
  })
  fileId = created.body?.id ?? null
  const createOk =
    created.status === 201 &&
    created.body?.classification === 'CONFIDENCIAL' &&
    created.body?.status === 'BORRADOR' &&
    Boolean(fileId)
  results.push({
    ok: createOk,
    label: '1. Crear Doc CONFIDENCIAL en _pruebas',
    detail: `HTTP ${created.status} id=${fileId ?? '?'}`,
  })

  // 2. Sidecar
  const meta = fileId ? await sidecar(fileId) : null
  const sidecarOk =
    meta?.classification === 'CONFIDENCIAL' && meta?.status === 'BORRADOR'
  results.push({
    ok: sidecarOk,
    label: '2. Sidecar driveFiles CONFIDENCIAL + BORRADOR',
    detail: meta ? JSON.stringify(meta) : 'sin documento',
  })

  // 3. Approve
  const approved = fileId
    ? await api(idToken, 'PATCH', `/api/drive/files/${fileId}/status`, {
        status: 'APROBADO',
        reason: REASON_APPROVE,
      })
    : { status: 0, body: { error: 'sin fileId' } }
  const approveOk =
    approved.status === 200 &&
    approved.body?.status === 'APROBADO' &&
    approved.body?.previousStatus === 'BORRADOR'
  results.push({
    ok: approveOk,
    label: '3. Aprobar (BORRADOR → APROBADO)',
    detail: `HTTP ${approved.status}`,
  })

  // 4. Grant
  const granted = fileId
    ? await api(idToken, 'POST', `/api/drive/files/${fileId}/permissions`, {
        email: GRANTEE,
        role: 'reader',
        reason: REASON_GRANT,
      })
    : { status: 0, body: { error: 'sin fileId' } }
  permissionId = granted.body?.id ?? null
  const grantOk = granted.status === 201 && Boolean(permissionId)
  results.push({
    ok: grantOk,
    label: `4. Otorgar type=user a ${GRANTEE}`,
    detail: `HTTP ${granted.status} permissionId=${permissionId ?? '?'}`,
  })

  // 5. Audit after create/approve/grant
  const audit1 = fileId
    ? await auditByTarget(idToken, fileId)
    : { status: 0, body: { logs: [] } }
  const logs1 = Array.isArray(audit1.body?.logs) ? audit1.body.logs : []
  const ordered1 = chrono(logs1)
  const actions1 = ordered1.map((l) => l.action)
  const hasClassificationChange = actions1.includes('classification_change')
  const iCreate = actionIndex(logs1, 'create')
  const iApproval = actionIndex(logs1, 'approval')
  const iGrant = actionIndex(logs1, 'permission_grant')
  const createLog = ordered1.find((l) => l.action === 'create')
  const approvalLog = ordered1.find((l) => l.action === 'approval')
  const grantLog = ordered1.find((l) => l.action === 'permission_grant')
  const audit1Ok =
    audit1.status === 200 &&
    iCreate >= 0 &&
    iApproval > iCreate &&
    iGrant > iApproval &&
    createLog?.reason === REASON_CREATE &&
    createLog?.metadata?.classification === 'CONFIDENCIAL' &&
    approvalLog?.reason === REASON_APPROVE &&
    approvalLog?.metadata?.previousStatus === 'BORRADOR' &&
    approvalLog?.metadata?.status === 'APROBADO' &&
    grantLog?.reason === REASON_GRANT &&
    grantLog?.metadata?.granteeEmail === GRANTEE &&
    !hasClassificationChange
  results.push({
    ok: audit1Ok,
    label: '5. Audit por targetId (create → approval → permission_grant)',
    detail: `HTTP ${audit1.status} acciones=[${actions1.join(', ')}]${
      hasClassificationChange
        ? ' (inesperado: classification_change)'
        : ' (sin classification_change al crear: correcto)'
    }`,
  })

  // 6. Revoke
  const revoked =
    fileId && permissionId
      ? await api(
          idToken,
          'POST',
          `/api/drive/files/${fileId}/permissions/${permissionId}/revoke`,
          { reason: REASON_REVOKE },
        )
      : { status: 0, body: { error: 'sin permissionId' } }
  const revokeOk = revoked.status === 200 && revoked.body?.revoked === true
  results.push({
    ok: revokeOk,
    label: '6. Revocar el permiso del paso 4',
    detail: `HTTP ${revoked.status}`,
  })

  // 7. Audit again
  const audit2 = fileId
    ? await auditByTarget(idToken, fileId)
    : { status: 0, body: { logs: [] } }
  const logs2 = Array.isArray(audit2.body?.logs) ? audit2.body.logs : []
  const ordered2 = chrono(logs2)
  const actions2 = ordered2.map((l) => l.action)
  const iRevoke = actionIndex(logs2, 'permission_revoke')
  const revokeLog = ordered2.find((l) => l.action === 'permission_revoke')
  const expected = ['create', 'approval', 'permission_grant', 'permission_revoke']
  const sequenceOk = expected.every((a, idx, arr) => {
    const i = actionIndex(logs2, a)
    if (i < 0) return false
    if (idx === 0) return true
    return i > actionIndex(logs2, arr[idx - 1])
  })
  const audit2Ok =
    audit2.status === 200 &&
    sequenceOk &&
    iRevoke >= 0 &&
    revokeLog?.reason === REASON_REVOKE &&
    revokeLog?.metadata?.permissionId === permissionId
  results.push({
    ok: audit2Ok,
    label: '7. Audit incluye permission_revoke en orden',
    detail: `acciones=[${actions2.join(', ')}]`,
  })

  console.log('--- Pasos ---')
  for (const r of results) {
    console.log(stepLine(r.ok, r.label, r.detail))
  }
  console.log('')
  console.log('--- Archivo ---')
  console.log(`fileId: ${fileId ?? '(no se creó)'}`)
  if (fileId) {
    console.log(`Drive: https://docs.google.com/document/d/${fileId}/edit`)
    console.log(`Panel: /admin/auditoria  filtro archivo = ${fileId}`)
  }
  console.log('')
  console.log('Nota: al crear con classification en el body NO se escribe')
  console.log('classification_change; queda en el log create (metadata.classification).')
  console.log('')

  if (ordered2.length) {
    console.log('--- Logs (cronológico) ---')
    for (const l of ordered2) {
      console.log(
        `${l.createdAt}  ${l.action.padEnd(20)}  reason=${JSON.stringify(l.reason ?? '')}`,
      )
    }
  }

  const allOk = results.every((r) => r.ok)
  console.log('')
  console.log(allOk ? 'RESULTADO: todas las etapas OK' : 'RESULTADO: hay fallos (ver FAIL arriba)')
  process.exit(allOk ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
