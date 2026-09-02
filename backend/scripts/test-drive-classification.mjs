/**
 * Casos de classification (create default / RESTRINGIDO + PATCH).
 *
 *   node backend/scripts/test-drive-classification.mjs
 */

import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const PARENT = '1xSy-TSp4EFeqYJ2n772X46Pj5WM42WZ5'
const REASON_OK = 'Prueba de clasificacion de sensibilidad segun politica de datos'

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
    // HTML u otro
  }
  return { status: res.status, body: parsed }
}

function printCase(title, result) {
  console.log(`\n=== ${title} ===`)
  console.log(`HTTP ${result.status}`)
  console.log(typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2))
}

async function storedClassification(fileId) {
  const snap = await getAdminDb().collection('driveFiles').doc(fileId).get()
  return snap.exists ? snap.get('classification') : null
}

async function latestClassificationAudit(fileId) {
  const q = await getAdminDb()
    .collection('auditLogs')
    .where('targetId', '==', fileId)
    .where('action', '==', 'classification_change')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  if (q.empty) return null
  const data = q.docs[0].data()
  return {
    id: q.docs[0].id,
    metadata: data.metadata ?? {},
    reason: data.reason,
  }
}

async function main() {
  const { uid, email, idToken } = await getTestIdToken()
  process.stderr.write(`Usando uid=${uid} email=${email}\n`)

  const stamp = Date.now()

  const case1 = await api(idToken, 'POST', '/api/drive/files', {
    name: `Prueba clasificacion default ${stamp}`,
    type: 'google_doc',
    parentFolderId: PARENT,
    reason: REASON_OK,
  })
  printCase('1. create sin classification (esperado 201 + USO_INTERNO)', case1)
  const id1 = typeof case1.body === 'object' ? case1.body.id : null
  const stored1 = id1 ? await storedClassification(id1) : null
  console.log(`Firestore driveFiles/${id1}: ${JSON.stringify(stored1)}`)

  const case2 = await api(idToken, 'POST', '/api/drive/files', {
    name: `Prueba clasificacion restringido ${stamp}`,
    type: 'google_doc',
    parentFolderId: PARENT,
    reason: REASON_OK,
    classification: 'RESTRINGIDO',
  })
  printCase('2. create con RESTRINGIDO (esperado 201)', case2)
  const id2 = typeof case2.body === 'object' ? case2.body.id : null
  const stored2 = id2 ? await storedClassification(id2) : null
  console.log(`Firestore driveFiles/${id2}: ${JSON.stringify(stored2)}`)

  const case3 = await api(idToken, 'PATCH', `/api/drive/files/${id1}/classification`, {
    classification: 'CONFIDENCIAL',
    reason: 'corto',
  })
  printCase('3. PATCH reason corto (esperado 400)', case3)

  const case4 = await api(idToken, 'PATCH', `/api/drive/files/${id1}/classification`, {
    classification: 'CONFIDENCIAL',
    reason: 'Cambio de clasificacion de USO_INTERNO a CONFIDENCIAL para prueba',
  })
  printCase('4. PATCH reason válido (esperado 200)', case4)
  const stored4 = id1 ? await storedClassification(id1) : null
  const audit = id1 ? await latestClassificationAudit(id1) : null
  console.log(`Firestore driveFiles/${id1} después del PATCH: ${JSON.stringify(stored4)}`)
  console.log(`auditLogs classification_change: ${JSON.stringify(audit, null, 2)}`)

  const ok =
    case1.status === 201 &&
    case1.body?.classification === 'USO_INTERNO' &&
    stored1 === 'USO_INTERNO' &&
    case2.status === 201 &&
    case2.body?.classification === 'RESTRINGIDO' &&
    stored2 === 'RESTRINGIDO' &&
    case3.status === 400 &&
    case4.status === 200 &&
    case4.body?.classification === 'CONFIDENCIAL' &&
    case4.body?.previousClassification === 'USO_INTERNO' &&
    stored4 === 'CONFIDENCIAL' &&
    audit?.metadata?.previousClassification === 'USO_INTERNO' &&
    audit?.metadata?.classification === 'CONFIDENCIAL'

  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
