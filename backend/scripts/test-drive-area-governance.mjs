/**
 * Gobernanza por área: aprobación, permisos, clasificación y copia autorizada.
 *
 *   npm run test:drive:governance
 */

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const SISTEMAS_DRIVE = '188-zgNhMIfeUjAI8GracINlItBbFwoUb'
const SISTEMAS_AREA = 'r7QVKsrSiqDWC8DrXCac'
const DEFAULT_EMAIL = 'implementaciones.it@bacarsa.com.ar'
const REASON =
  'Prueba de gobernanza por area segun politica de datos de la intranet Bacar'
const GRANTEE = 'implementaciones.ti@bacarsa.com.ar'
const EXTERNAL = 'destinatario.prueba.intranet@gmail.com'

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

function line(ok, label, detail) {
  return `${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`
}

async function latestAudit(targetId, action) {
  const q = await getAdminDb()
    .collection('auditLogs')
    .where('targetId', '==', targetId)
    .where('action', '==', action)
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  if (q.empty) return null
  const data = q.docs[0].data()
  return {
    id: q.docs[0].id,
    userEmail: data.userEmail ?? null,
    metadata: data.metadata ?? {},
    reason: data.reason,
  }
}

async function main() {
  const chiefEmail = (process.env.TEST_EMAIL?.trim() || DEFAULT_EMAIL).toLowerCase()
  process.env.TEST_EMAIL = 'admin@bacarsa.com.ar'
  const admin = await getTestIdToken()
  process.env.TEST_EMAIL = chiefEmail
  const chief = await getTestIdToken({ requireSuperAdmin: false })
  const db = getAdminDb()
  const userRef = db.collection('users').doc(chief.uid)
  const beforeSnap = await userRef.get()
  const beforeRole = beforeSnap.get('role') ?? null
  const beforeAreas = Array.isArray(beforeSnap.get('managedAreaIds'))
    ? [...beforeSnap.get('managedAreaIds')]
    : []

  const results = []
  console.log(`super_admin: ${admin.email}`)
  console.log(`jefe de prueba: ${chief.email} (${chief.role})`)
  console.log('')

  let areaFileId = null
  let otherFileId = null

  try {
    const createdArea = await api(admin.idToken, 'POST', '/api/drive/files', {
      name: `Prueba gobernanza área ${Date.now()}`,
      type: 'google_doc',
      parentFolderId: SISTEMAS_DRIVE,
      reason: REASON,
      classification: 'USO_INTERNO',
    })
    areaFileId = createdArea.body?.id ?? null
    results.push({
      ok: createdArea.status === 201 && createdArea.body?.governingAreaId === SISTEMAS_AREA,
      label: 'Setup archivo en Sistemas',
      detail: `HTTP ${createdArea.status}`,
    })

    const rootList = await api(admin.idToken, 'GET', '/api/drive/files?folderId=root')
    const otherFolder =
      rootList.body?.files?.find(
        (file) => file.isFolder && file.id !== SISTEMAS_DRIVE,
      ) ?? null
    if (otherFolder?.id) {
      const createdOther = await api(admin.idToken, 'POST', '/api/drive/files', {
        name: `Prueba otra área ${Date.now()}`,
        type: 'google_doc',
        parentFolderId: otherFolder.id,
        reason: REASON,
        classification: 'USO_INTERNO',
      })
      otherFileId = createdOther.body?.id ?? null
      results.push({
        ok: createdOther.status === 201 && createdOther.body?.governingAreaId !== SISTEMAS_AREA,
        label: 'Setup archivo en otra área',
        detail: `HTTP ${createdOther.status}; area=${createdOther.body?.governingAreaId ?? 'null'}`,
      })
    }

    const deniedClassification = areaFileId
      ? await api(chief.idToken, 'PATCH', `/api/drive/files/${areaFileId}/classification`, {
          classification: 'CONFIDENCIAL',
          reason: REASON,
        })
      : { status: 0, body: { error: 'sin fileId' } }
    results.push({
      ok: deniedClassification.status === 403,
      label: 'Sin área → clasificación 403',
      detail: `HTTP ${deniedClassification.status}`,
    })

    const deniedPermissions = areaFileId
      ? await api(chief.idToken, 'GET', `/api/drive/files/${areaFileId}/permissions`)
      : { status: 0, body: { error: 'sin fileId' } }
    results.push({
      ok: deniedPermissions.status === 403,
      label: 'Sin área → listar permisos 403',
      detail: `HTTP ${deniedPermissions.status}`,
    })

    const patch = { managedAreaIds: FieldValue.arrayUnion(SISTEMAS_AREA) }
    if (beforeRole !== 'super_admin' && beforeRole !== 'admin') {
      patch.role = 'admin'
    }
    await userRef.update(patch)

    const allowedClassification = areaFileId
      ? await api(chief.idToken, 'PATCH', `/api/drive/files/${areaFileId}/classification`, {
          classification: 'CONFIDENCIAL',
          reason: REASON,
        })
      : { status: 0, body: { error: 'sin fileId' } }
    results.push({
      ok: allowedClassification.status === 200,
      label: 'Con área → clasificación 200',
      detail: `HTTP ${allowedClassification.status}`,
    })

    const auditClassification = areaFileId
      ? await latestAudit(areaFileId, 'classification_change')
      : null
    results.push({
      ok: auditClassification?.userEmail === chief.email,
      label: 'Auditoría clasificación registra jefe',
      detail: auditClassification?.userEmail ?? 'sin log',
    })

    const grant = areaFileId
      ? await api(chief.idToken, 'POST', `/api/drive/files/${areaFileId}/permissions`, {
          email: GRANTEE,
          role: 'reader',
          reason: REASON,
        })
      : { status: 0, body: { error: 'sin fileId' } }
    const permissionId = typeof grant.body === 'object' ? grant.body.id : null
    results.push({
      ok: grant.status === 201 && Boolean(permissionId),
      label: 'Con área → otorgar permiso 201',
      detail: `HTTP ${grant.status}`,
    })

    const auditGrant = areaFileId ? await latestAudit(areaFileId, 'permission_grant') : null
    results.push({
      ok: auditGrant?.userEmail === chief.email,
      label: 'Auditoría grant registra jefe',
      detail: auditGrant?.userEmail ?? 'sin log',
    })

    const authorizedCopy = areaFileId
      ? await api(chief.idToken, 'POST', `/api/drive/files/${areaFileId}/authorized-copy`, {
          recipientName: 'Tercero de prueba',
          recipientEmail: EXTERNAL,
          purpose: REASON,
          reason: REASON,
        })
      : { status: 0, body: { error: 'sin fileId' } }
    results.push({
      ok: authorizedCopy.status === 201,
      label: 'Con área → copia autorizada 201',
      detail: `HTTP ${authorizedCopy.status}`,
    })

    const auditCopy = areaFileId ? await latestAudit(areaFileId, 'authorized_copy') : null
    results.push({
      ok: auditCopy?.userEmail === chief.email,
      label: 'Auditoría copia autorizada registra jefe',
      detail: auditCopy?.userEmail ?? 'sin log',
    })

    const revoke = permissionId
      ? await api(
          chief.idToken,
          'POST',
          `/api/drive/files/${areaFileId}/permissions/${permissionId}/revoke`,
          { reason: REASON },
        )
      : { status: 0, body: { error: 'sin permissionId' } }
    results.push({
      ok: revoke.status === 200 && revoke.body?.revoked === true,
      label: 'Con área → revocar permiso 200',
      detail: `HTTP ${revoke.status}`,
    })

    const auditRevoke = areaFileId ? await latestAudit(areaFileId, 'permission_revoke') : null
    results.push({
      ok: auditRevoke?.userEmail === chief.email,
      label: 'Auditoría revoke registra jefe',
      detail: auditRevoke?.userEmail ?? 'sin log',
    })

    if (otherFileId) {
      const deniedOther = await api(
        chief.idToken,
        'PATCH',
        `/api/drive/files/${otherFileId}/classification`,
        { classification: 'RESTRINGIDO', reason: REASON },
      )
      results.push({
        ok: deniedOther.status === 403,
        label: 'Otra área → clasificación 403',
        detail: `HTTP ${deniedOther.status}`,
      })

      const deniedOtherCopy = await api(
        chief.idToken,
        'POST',
        `/api/drive/files/${otherFileId}/authorized-copy`,
        {
          recipientName: 'Tercero de prueba',
          recipientEmail: EXTERNAL,
          purpose: REASON,
          reason: REASON,
        },
      )
      results.push({
        ok: deniedOtherCopy.status === 403,
        label: 'Otra área → copia autorizada 403',
        detail: `HTTP ${deniedOtherCopy.status}`,
      })
    }
  } finally {
    await userRef.update({
      role: beforeRole,
      managedAreaIds: beforeAreas,
    })
  }

  console.log('--- Gobernanza por área ---')
  for (const result of results) {
    console.log(line(result.ok, result.label, result.detail))
  }
  const ok = results.length > 0 && results.every((result) => result.ok)
  console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: fallos')
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
