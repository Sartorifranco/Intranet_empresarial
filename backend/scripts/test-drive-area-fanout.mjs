/**
 * Fan-out de permisos al área gobernante del archivo.
 *
 *   npm run test:drive:area-fanout
 */

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const SISTEMAS_DRIVE = '188-zgNhMIfeUjAI8GracINlItBbFwoUb'
const SISTEMAS_AREA = 'r7QVKsrSiqDWC8DrXCac'
const OTHER_AREA = 'GgnU5ZugU1FO0wlOaXUV'
const DEFAULT_EMAIL = 'implementaciones.it@bacarsa.com.ar'
const MEMBER_EMAIL = process.env.FANOUT_MEMBER_EMAIL?.trim() || 'admin@bacarsa.com.ar'
const OUTSIDER_EMAIL =
  process.env.FANOUT_OUTSIDER_EMAIL?.trim() || 'sistemas.ti@bacarsa.com.ar'
const REASON = 'Prueba fan-out permisos area gobernante intranet Bacar'

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
    .limit(5)
    .get()
  return q.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
}

async function main() {
  process.env.TEST_EMAIL = 'admin@bacarsa.com.ar'
  const admin = await getTestIdToken()
  process.env.TEST_EMAIL = DEFAULT_EMAIL
  const chief = await getTestIdToken({ requireSuperAdmin: false })
  const db = getAdminDb()
  const chiefRef = db.collection('users').doc(chief.uid)
  const memberSnap = await db.collection('users').where('email', '==', MEMBER_EMAIL).limit(1).get()
  const memberDoc = memberSnap.docs[0]
  if (!memberDoc) {
    console.error(`Usuario ${MEMBER_EMAIL} no encontrado`)
    process.exit(1)
  }
  const memberRef = memberDoc.ref
  const outsiderSnap = await db.collection('users').where('email', '==', OUTSIDER_EMAIL).limit(1).get()
  const outsiderDoc = outsiderSnap.docs[0]
  if (!outsiderDoc) {
    console.error(`Usuario ${OUTSIDER_EMAIL} no encontrado`)
    process.exit(1)
  }
  const outsiderRef = outsiderDoc.ref

  const beforeChief = await chiefRef.get()
  const beforeChiefAreas = Array.isArray(beforeChief.get('managedAreaIds'))
    ? [...beforeChief.get('managedAreaIds')]
    : []
  const beforeChiefRole = beforeChief.get('role') ?? null
  const beforeMemberAreas = Array.isArray(memberDoc.get('memberAreaIds'))
    ? [...memberDoc.get('memberAreaIds')]
    : []
  const beforeOutsiderMemberAreas = Array.isArray(outsiderDoc.get('memberAreaIds'))
    ? [...outsiderDoc.get('memberAreaIds')]
    : []
  const beforeOutsiderManagedAreas = Array.isArray(outsiderDoc.get('managedAreaIds'))
    ? [...outsiderDoc.get('managedAreaIds')]
    : []

  const results = []
  let fileId = null
  let otherFileId = null
  let batchId = null

  try {
    await chiefRef.update({
      managedAreaIds: FieldValue.arrayUnion(SISTEMAS_AREA),
      ...(beforeChiefRole !== 'admin' && beforeChiefRole !== 'super_admin'
        ? { role: 'admin' }
        : {}),
    })
    await memberRef.update({
      memberAreaIds: FieldValue.arrayUnion(SISTEMAS_AREA),
    })
    // Asegurar que el outsider NO pertenece a Sistemas durante la prueba.
    await outsiderRef.update({
      memberAreaIds: beforeOutsiderMemberAreas.filter((id) => id !== SISTEMAS_AREA),
      managedAreaIds: beforeOutsiderManagedAreas.filter((id) => id !== SISTEMAS_AREA),
    })

    const created = await api(admin.idToken, 'POST', '/api/drive/files', {
      name: `Prueba fan-out área ${Date.now()}`,
      type: 'google_doc',
      parentFolderId: SISTEMAS_DRIVE,
      reason: REASON,
      classification: 'USO_INTERNO',
    })
    fileId = created.body?.id ?? null
    results.push({
      ok: created.status === 201 && created.body?.governingAreaId === SISTEMAS_AREA,
      label: 'Setup archivo en Sistemas',
      detail: `HTTP ${created.status}`,
    })

    const rootList = await api(admin.idToken, 'GET', '/api/drive/files?folderId=root')
    const otherFolder = rootList.body?.files?.find(
      (file) => file.isFolder && file.governingAreaId && file.governingAreaId !== SISTEMAS_AREA,
    )
    if (otherFolder?.id) {
      const createdOther = await api(admin.idToken, 'POST', '/api/drive/files', {
        name: `Prueba fan-out otra área ${Date.now()}`,
        type: 'google_doc',
        parentFolderId: otherFolder.id,
        reason: REASON,
      })
      otherFileId = createdOther.body?.id ?? null
    }

    const deniedOther = otherFileId
      ? await api(chief.idToken, 'POST', `/api/drive/files/${otherFileId}/permissions/area`, {
          role: 'reader',
          reason: REASON,
        })
      : { status: 403, body: {} }
    results.push({
      ok: deniedOther.status === 403,
      label: 'Otra área → fan-out 403',
      detail: `HTTP ${deniedOther.status}`,
    })

    const fanOut = fileId
      ? await api(chief.idToken, 'POST', `/api/drive/files/${fileId}/permissions/area`, {
          role: 'reader',
          reason: REASON,
        })
      : { status: 0, body: { error: 'sin fileId' } }
    batchId = fanOut.body?.batchId ?? null
    const grantedEmails = (fanOut.body?.granted ?? [])
      .map((row) => String(row.email ?? '').trim().toLowerCase())
      .filter(Boolean)
    const expectedEmails = new Set(
      [chief.email, MEMBER_EMAIL].map((email) => email.trim().toLowerCase()),
    )
    results.push({
      ok:
        (fanOut.status === 201 || fanOut.status === 207) &&
        grantedEmails.length === expectedEmails.size &&
        [...expectedEmails].every((email) => grantedEmails.includes(email)),
      label: 'Fan-out Sistemas → miembros + jefe sin duplicados',
      detail: `HTTP ${fanOut.status}; granted=${grantedEmails.join(', ')}`,
    })

    results.push({
      ok: !grantedEmails.includes(OUTSIDER_EMAIL.trim().toLowerCase()),
      label: 'Outsider no recibe acceso en fan-out',
      detail: OUTSIDER_EMAIL,
    })

    const audits = fileId ? await latestAudit(fileId, 'permission_grant') : []
    const batchLogs = batchId
      ? audits.filter((row) => row.metadata?.areaFanOut?.batchId === batchId)
      : []
    const grantedUids = new Set((fanOut.body?.granted ?? []).map((row) => row.uid))
    results.push({
      ok:
        batchLogs.length === grantedUids.size &&
        batchLogs.length >= 2 &&
        batchLogs.every((row) => row.userEmail === chief.email) &&
        batchLogs.every((row) => typeof row.metadata?.areaFanOut?.batchId === 'string') &&
        [...grantedUids].every((uid) =>
          batchLogs.some((row) => row.metadata?.granteeUid === uid),
        ),
      label: 'Auditoría: un log por persona con batchId compartido',
      detail: `logs=${batchLogs.length}; batchId=${batchId ?? 'null'}`,
    })
  } finally {
    await chiefRef.update({
      role: beforeChiefRole,
      managedAreaIds: beforeChiefAreas,
    })
    await memberRef.update({ memberAreaIds: beforeMemberAreas })
    await outsiderRef.update({
      memberAreaIds: beforeOutsiderMemberAreas,
      managedAreaIds: beforeOutsiderManagedAreas,
    })
  }

  console.log('--- Fan-out por área ---')
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
