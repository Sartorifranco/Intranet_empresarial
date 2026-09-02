/**
 * Frente 1: valida list/create/trash con el subject del usuario autenticado.
 *
 * Prepara acceso writer de un usuario no-super_admin a `_pruebas` usando el
 * endpoint de gobernanza (que sigue impersonando datos@), y luego prueba las
 * operaciones cotidianas con el token de ese usuario.
 *
 *   npm run test:drive:user
 */

import { pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getTestIdToken, loadTestEnv } from './get-test-token.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const TEST_FOLDER_ID = '1xSy-TSp4EFeqYJ2n772X46Pj5WM42WZ5'
const REASON_GRANT = 'Frente 1: habilitar escritura del usuario de prueba en _pruebas'
const REASON_CREATE = 'Frente 1: crear como usuario real dentro de la carpeta autorizada'
const REASON_DENIED = 'Frente 1: verificar rechazo al crear fuera de la carpeta autorizada'
const REASON_TRASH = 'Frente 1: enviar a papelera el archivo creado por el usuario real'

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

function line(ok, label, detail) {
  return `${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`
}

async function createdBy(fileId) {
  loadTestEnv()
  const moduleUrl = pathToFileURL(
    resolve(ROOT, 'backend/lib/lib/google/driveClient.js'),
  ).href
  const { getDrive } = await import(moduleUrl)
  const drive = await getDrive()
  const meta = await drive.files.get({
    fileId,
    supportsAllDrives: true,
    fields: 'id,lastModifyingUser(emailAddress,displayName),trashed',
  })
  return {
    email: meta.data.lastModifyingUser?.emailAddress ?? null,
    trashed: Boolean(meta.data.trashed),
  }
}

async function main() {
  const regularEmail = (process.env.TEST_EMAIL?.trim() || '').toLowerCase()
  process.env.TEST_EMAIL = 'admin@bacarsa.com.ar'
  const admin = await getTestIdToken()
  if (regularEmail) process.env.TEST_EMAIL = regularEmail
  else delete process.env.TEST_EMAIL
  const regular = await getTestIdToken({ requireSuperAdmin: false })
  const results = []

  console.log(`Gobernanza: ${admin.email} (${admin.role})`)
  console.log(`Usuario real: ${regular.email} (${regular.role})`)
  console.log('')

  const adminRoot = await api(admin.idToken, 'GET', '/api/drive/files?folderId=root')
  const rootFiles = Array.isArray(adminRoot.body?.files) ? adminRoot.body.files : []
  const inaccessibleFolder =
    rootFiles.find((file) => file.isFolder && file.id !== TEST_FOLDER_ID)?.id ?? 'root'

  const grant = await api(
    admin.idToken,
    'POST',
    `/api/drive/files/${TEST_FOLDER_ID}/permissions`,
    {
      type: 'user',
      email: regular.email,
      role: 'writer',
      reason: REASON_GRANT,
    },
  )
  const grantOk = grant.status === 201 && grant.body?.driveRole === 'fileOrganizer'
  results.push({
    ok: grantOk,
    label: 'Preparar fileOrganizer (writer API) sobre _pruebas',
    detail: `HTTP ${grant.status}; driveRole=${grant.body?.driveRole ?? '?'}`,
  })

  await new Promise((resolvePromise) => setTimeout(resolvePromise, 1500))

  const userRoot = await api(regular.idToken, 'GET', '/api/drive/files?folderId=root')
  const userFolder = await api(
    regular.idToken,
    'GET',
    `/api/drive/files?folderId=${TEST_FOLDER_ID}`,
  )
  const scopedOk =
    userFolder.status === 200 &&
    adminRoot.status === 200 &&
    (userRoot.status === 403 ||
      userRoot.status === 404 ||
      (userRoot.status === 200 &&
        (userRoot.body?.files?.length ?? 0) < (adminRoot.body?.files?.length ?? 0)))
  results.push({
    ok: scopedOk,
    label: 'Usuario ve _pruebas pero no el árbol completo',
    detail:
      `carpeta HTTP ${userFolder.status}; raíz usuario HTTP ${userRoot.status}` +
      (userRoot.status === 200
        ? ` (${userRoot.body?.files?.length ?? 0}/${adminRoot.body?.files?.length ?? 0} ítems)`
        : ''),
  })

  const created = await api(regular.idToken, 'POST', '/api/drive/files', {
    name: `Frente 1 usuario real ${Date.now()}`,
    type: 'google_doc',
    parentFolderId: TEST_FOLDER_ID,
    classification: 'USO_INTERNO',
    reason: REASON_CREATE,
  })
  const fileId = created.body?.id ?? null
  const createOk = created.status === 201 && Boolean(fileId)
  results.push({
    ok: createOk,
    label: 'Crear en carpeta con escritura',
    detail: `HTTP ${created.status}; id=${fileId ?? '?'}`,
  })

  let identity = { email: null, trashed: false }
  if (fileId) identity = await createdBy(fileId)
  const identityOk = identity.email?.toLowerCase() === regular.email.toLowerCase()
  results.push({
    ok: identityOk,
    label: 'Drive registra al usuario real como modificador',
    detail: `lastModifyingUser=${identity.email ?? '?'}`,
  })

  const denied = await api(regular.idToken, 'POST', '/api/drive/files', {
    name: `Frente 1 intento sin acceso ${Date.now()}`,
    type: 'google_doc',
    parentFolderId: inaccessibleFolder,
    classification: 'USO_INTERNO',
    reason: REASON_DENIED,
  })
  const deniedOk =
    (denied.status === 403 || denied.status === 404) &&
    typeof denied.body?.error === 'string' &&
    !denied.body.error.includes('No se pudo crear')
  results.push({
    ok: deniedOk,
    label: 'Crear fuera del acceso es rechazado claramente',
    detail: `HTTP ${denied.status}; ${JSON.stringify(denied.body?.error ?? denied.body)}`,
  })

  const trashed = fileId
    ? await api(
        regular.idToken,
        'POST',
        `/api/drive/files/${fileId}/trash`,
        { reason: REASON_TRASH },
      )
    : { status: 0, body: { error: 'sin fileId' } }
  const afterTrash = fileId ? await createdBy(fileId) : identity
  const trashOk =
    trashed.status === 200 && trashed.body?.trashed === true && afterTrash.trashed
  results.push({
    ok: trashOk,
    label: 'Enviar a papelera con la identidad real',
    detail: `HTTP ${trashed.status}; trashed=${afterTrash.trashed}`,
  })

  console.log('--- Frente 1 ---')
  for (const result of results) {
    console.log(line(result.ok, result.label, result.detail))
  }
  console.log('')
  console.log(`Usuario probado: ${regular.email} (${regular.role})`)
  console.log(`Carpeta autorizada: ${TEST_FOLDER_ID}`)
  console.log(`Carpeta no autorizada probada: ${inaccessibleFolder}`)
  console.log(`Archivo creado y enviado a papelera: ${fileId ?? '(no creado)'}`)
  console.log('')

  const ok = results.every((result) => result.ok)
  console.log(ok ? 'RESULTADO: Frente 1 OK' : 'RESULTADO: Frente 1 con fallos')
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
