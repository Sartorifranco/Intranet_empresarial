/**
 * Estado de aprobación (BORRADOR → APROBADO).
 *
 *   node backend/scripts/test-drive-status.mjs
 */

import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const PARENT = '1xSy-TSp4EFeqYJ2n772X46Pj5WM42WZ5'
const REASON_OK = 'Aprobacion de prueba del documento segun politica de datos'

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

function printCase(title, result) {
  console.log(`\n=== ${title} ===`)
  console.log(`HTTP ${result.status}`)
  console.log(typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2))
}

async function storedStatus(fileId) {
  const snap = await getAdminDb().collection('driveFiles').doc(fileId).get()
  return snap.exists ? snap.get('status') : null
}

async function latestApproval(fileId) {
  const q = await getAdminDb()
    .collection('auditLogs')
    .where('targetId', '==', fileId)
    .where('action', '==', 'approval')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  if (q.empty) return null
  const data = q.docs[0].data()
  return { id: q.docs[0].id, metadata: data.metadata ?? {}, reason: data.reason }
}

async function main() {
  const { uid, email, idToken } = await getTestIdToken()
  process.stderr.write(`Usando uid=${uid} email=${email}\n`)

  const case1 = await api(idToken, 'POST', '/api/drive/files', {
    name: `Prueba estado borrador ${Date.now()}`,
    type: 'google_doc',
    parentFolderId: PARENT,
    reason: REASON_OK,
  })
  printCase('1. create → BORRADOR (esperado 201)', case1)
  const id = typeof case1.body === 'object' ? case1.body.id : null
  const stored1 = id ? await storedStatus(id) : null
  console.log(`Firestore driveFiles/${id}.status: ${JSON.stringify(stored1)}`)

  const case2 = await api(idToken, 'PATCH', `/api/drive/files/${id}/status`, {
    status: 'APROBADO',
    reason: 'corto',
  })
  printCase('2. APROBADO con reason corto (esperado 400)', case2)

  const case3 = await api(idToken, 'PATCH', `/api/drive/files/${id}/status`, {
    status: 'APROBADO',
    reason: REASON_OK,
  })
  printCase('3. APROBADO con reason válido (esperado 200)', case3)
  const stored3 = id ? await storedStatus(id) : null
  const audit = id ? await latestApproval(id) : null
  console.log(`Firestore status después: ${JSON.stringify(stored3)}`)
  console.log(`auditLogs approval: ${JSON.stringify(audit, null, 2)}`)

  const case4 = await api(idToken, 'PATCH', `/api/drive/files/${id}/status`, {
    status: 'APROBADO',
    reason: REASON_OK,
  })
  printCase('4. re-aprobar (esperado 409)', case4)

  const ok =
    case1.status === 201 &&
    case1.body?.status === 'BORRADOR' &&
    stored1 === 'BORRADOR' &&
    case2.status === 400 &&
    case3.status === 200 &&
    case3.body?.status === 'APROBADO' &&
    case3.body?.previousStatus === 'BORRADOR' &&
    stored3 === 'APROBADO' &&
    audit?.metadata?.previousStatus === 'BORRADOR' &&
    audit?.metadata?.status === 'APROBADO' &&
    case4.status === 409

  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
