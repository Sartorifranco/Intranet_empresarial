/**
 * POST /api/drive/files/:fileId/trash — reason según MIME.
 *
 *   npm run test:drive:trash
 */

import { pathToFileURL } from 'node:url'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAdminDb, getTestIdToken, loadTestEnv } from './get-test-token.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const PARENT = '1xSy-TSp4EFeqYJ2n772X46Pj5WM42WZ5'
const PDF_ID = '1Rj1KsF7PeJ9N6sXEuRxARVVdqQWCbtNR'
const MISSING_ID = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
const REASON_OK = 'Prueba de envio a papelera con motivo informado'

function apiBase() {
  return (
    process.env.FUNCTIONS_API_BASE?.trim() ||
    'http://127.0.0.1:5001/bacar-web/southamerica-east1/api'
  )
}

async function getDriveClient() {
  loadTestEnv()
  const modPath = pathToFileURL(resolve(ROOT, 'backend/lib/lib/google/driveClient.js')).href
  const { getDrive } = await import(modPath)
  return getDrive()
}

async function setTrashed(fileId, trashed) {
  const drive = await getDriveClient()
  await drive.files.update({
    fileId,
    requestBody: { trashed },
    supportsAllDrives: true,
  })
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

async function latestDelete(fileId) {
  const q = await getAdminDb()
    .collection('auditLogs')
    .where('targetId', '==', fileId)
    .where('action', '==', 'delete')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get()
  if (q.empty) return null
  const data = q.docs[0].data()
  return { id: q.docs[0].id, reason: data.reason ?? null }
}

async function main() {
  process.env.TEST_EMAIL = 'admin@bacarsa.com.ar'
  const { uid, email, idToken } = await getTestIdToken()
  process.stderr.write(`Usando uid=${uid} email=${email}\n`)

  try {
    await setTrashed(PDF_ID, false)
  } catch (err) {
    process.stderr.write(
      `No pude restaurar el PDF: ${err instanceof Error ? err.message : err}\n`,
    )
  }

  const created = await api(idToken, 'POST', '/api/drive/files', {
    name: `Prueba trash doc ${Date.now()}`,
    type: 'google_doc',
    parentFolderId: PARENT,
    reason: REASON_OK,
  })
  const docId = created.body?.id ?? null
  printCase('setup Google Doc (esperado 201)', created)

  const caseDoc = docId
    ? await api(idToken, 'POST', `/api/drive/files/${docId}/trash`, {})
    : { status: 0, body: { error: 'sin docId' } }
  printCase('1. Google Doc sin reason (esperado 400)', caseDoc)

  const caseMissing = await api(idToken, 'POST', `/api/drive/files/${MISSING_ID}/trash`, {})
  printCase('2. fileId inexistente (esperado 404)', caseMissing)

  const casePdfNoReason = await api(idToken, 'POST', `/api/drive/files/${PDF_ID}/trash`, {})
  printCase('3. PDF sin reason (esperado 200)', casePdfNoReason)
  const auditNoReason = await latestDelete(PDF_ID)
  console.log(`audit PDF sin reason: ${JSON.stringify(auditNoReason)}`)

  try {
    await setTrashed(PDF_ID, false)
  } catch (err) {
    process.stderr.write(
      `No pude restaurar el PDF para el caso 4: ${err instanceof Error ? err.message : err}\n`,
    )
  }

  const casePdfWithReason = await api(idToken, 'POST', `/api/drive/files/${PDF_ID}/trash`, {
    reason: REASON_OK,
  })
  printCase('4. PDF con reason (esperado 200)', casePdfWithReason)
  const auditWithReason = await latestDelete(PDF_ID)
  console.log(`audit PDF con reason: ${JSON.stringify(auditWithReason)}`)

  if (docId) {
    try {
      await setTrashed(docId, true)
    } catch {
      // el 400 no lo tiró a papelera; datos@ lo limpia
    }
  }

  const ok =
    created.status === 201 &&
    Boolean(docId) &&
    caseDoc.status === 400 &&
    caseMissing.status === 404 &&
    casePdfNoReason.status === 200 &&
    auditNoReason?.reason === null &&
    casePdfWithReason.status === 200 &&
    auditWithReason?.reason === REASON_OK

  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
