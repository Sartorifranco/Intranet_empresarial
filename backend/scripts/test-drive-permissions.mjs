/**
 * Paso 5: grants user/domain, classification, copia autorizada, revoke.
 *
 *   node backend/scripts/test-drive-permissions.mjs
 */

import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const PARENT = '1xSy-TSp4EFeqYJ2n772X46Pj5WM42WZ5'
const REASON_OK = 'Prueba de permisos Drive del paso 5 de la intranet'
const PURPOSE_OK = 'Entrega de prueba a un tercero externo para validar copia autorizada'
async function pickInternalGrantee(actorEmail) {
  // admin@ ya tiene acceso heredado a la unidad; revocar ese permissionId falla.
  // Preferimos un @bacarsa que no sea miembro de la Shared Drive.
  const preferred = 'implementaciones.ti@bacarsa.com.ar'
  if (preferred !== actorEmail) return preferred
  return 'admin@bacarsa.com.ar'
}
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
    // HTML u otro
  }
  return { status: res.status, body: parsed }
}

function printCase(title, result) {
  console.log(`\n=== ${title} ===`)
  console.log(`HTTP ${result.status}`)
  console.log(typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2))
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
  return { id: q.docs[0].id, metadata: data.metadata ?? {}, reason: data.reason }
}

async function createFile(idToken, name, classification) {
  return api(idToken, 'POST', '/api/drive/files', {
    name,
    type: 'google_doc',
    parentFolderId: PARENT,
    reason: REASON_OK,
    classification,
  })
}

async function main() {
  const { uid, email, idToken } = await getTestIdToken()
  process.stderr.write(`Usando uid=${uid} email=${email}\n`)
  const grantee = await pickInternalGrantee(email)
  process.stderr.write(`Grantee interno: ${grantee}\n`)
  const stamp = Date.now()

  const createdInternal = await createFile(
    idToken,
    `Prueba permisos USO_INTERNO ${stamp}`,
    'USO_INTERNO',
  )
  if (createdInternal.status !== 201) {
    printCase('setup USO_INTERNO', createdInternal)
    process.exit(1)
  }
  const internalId = createdInternal.body.id

  const createdRestricted = await createFile(
    idToken,
    `Prueba permisos RESTRINGIDO ${stamp}`,
    'RESTRINGIDO',
  )
  if (createdRestricted.status !== 201) {
    printCase('setup RESTRINGIDO', createdRestricted)
    process.exit(1)
  }
  const restrictedId = createdRestricted.body.id

  const createdConfidential = await createFile(
    idToken,
    `Prueba permisos CONFIDENCIAL ${stamp}`,
    'CONFIDENCIAL',
  )
  if (createdConfidential.status !== 201) {
    printCase('setup CONFIDENCIAL', createdConfidential)
    process.exit(1)
  }
  const confidentialId = createdConfidential.body.id

  const case1 = await api(idToken, 'POST', `/api/drive/files/${internalId}/permissions`, {
    email: grantee,
    role: 'reader',
    reason: REASON_OK,
  })
  printCase('1. type user sobre USO_INTERNO (esperado 201)', case1)
  const permissionId = typeof case1.body === 'object' ? case1.body.id : null
  const audit1 = await latestAudit(internalId, 'permission_grant')

  const case2 = await api(idToken, 'POST', `/api/drive/files/${restrictedId}/permissions`, {
    type: 'domain',
    role: 'reader',
    reason: REASON_OK,
  })
  printCase('2. type domain sobre RESTRINGIDO (esperado 403)', case2)

  const case3 = await api(idToken, 'POST', `/api/drive/files/${confidentialId}/permissions`, {
    type: 'domain',
    role: 'reader',
    reason: REASON_OK,
  })
  printCase('3. type domain sobre CONFIDENCIAL (esperado 201)', case3)

  const case4 = await api(idToken, 'POST', `/api/drive/files/${restrictedId}/authorized-copy`, {
    recipientName: 'Estudio Externo de Prueba',
    recipientEmail: EXTERNAL,
    purpose: PURPOSE_OK,
    reason: REASON_OK,
  })
  printCase('4. copia autorizada de RESTRINGIDO (esperado 201)', case4)
  const copyId = typeof case4.body === 'object' ? case4.body.id : null
  const audit4 = await latestAudit(restrictedId, 'authorized_copy')
  console.log(`audit authorized_copy: ${JSON.stringify(audit4, null, 2)}`)

  const case5 = permissionId
    ? await api(
        idToken,
        'POST',
        `/api/drive/files/${internalId}/permissions/${permissionId}/revoke`,
        { reason: 'Revocacion de prueba del permiso otorgado en el caso 1' },
      )
    : { status: 0, body: { error: 'sin permissionId del caso 1' } }
  printCase('5. revocar permiso del caso 1 (esperado 200)', case5)
  const audit5 = await latestAudit(internalId, 'permission_revoke')
  console.log(`audit permission_revoke: ${JSON.stringify(audit5, null, 2)}`)

  const ok =
    case1.status === 201 &&
    Boolean(permissionId) &&
    audit1?.metadata?.granteeEmail === grantee &&
    case2.status === 403 &&
    typeof case2.body?.error === 'string' &&
    case2.body.error.toLowerCase().includes('restringid') &&
    case3.status === 201 &&
    case3.body?.type === 'domain' &&
    case4.status === 201 &&
    Boolean(copyId) &&
    audit4?.metadata?.copyFileId === copyId &&
    audit4?.metadata?.recipientEmail === EXTERNAL &&
    case5.status === 200 &&
    case5.body?.revoked === true &&
    audit5?.metadata?.permissionId === permissionId

  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
