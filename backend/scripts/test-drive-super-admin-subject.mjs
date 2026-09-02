/**
 * Valida que super_admin sin membresía Drive ve la raíz completa vía datos@,
 * y que un usuario común sigue acotado a su acceso real.
 *
 *   node backend/scripts/test-drive-super-admin-subject.mjs
 */

import { getTestIdToken } from './get-test-token.mjs'

const TEST_FOLDER_ID = '1xSy-TSp4EFeqYJ2n772X46Pj5WM42WZ5'
const REASON = 'Salvaguarda super_admin: prueba create/trash con subject datos@'

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
    // noop
  }
  return { status: res.status, body: parsed }
}

function line(ok, label, detail) {
  return `${ok ? 'OK  ' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`
}

async function main() {
  process.env.TEST_EMAIL = 'admin@bacarsa.com.ar'
  const admin = await getTestIdToken()

  process.env.TEST_EMAIL = 'sistemas.ti@bacarsa.com.ar'
  const sistemas = await getTestIdToken()

  delete process.env.TEST_EMAIL
  const regular = await getTestIdToken({ requireSuperAdmin: false })

  const results = []

  const adminRoot = await api(admin.idToken, 'GET', '/api/drive/files?folderId=root')
  const sistemasRoot = await api(sistemas.idToken, 'GET', '/api/drive/files?folderId=root')
  const adminCount = adminRoot.body?.files?.length ?? 0
  const sistemasCount = sistemasRoot.body?.files?.length ?? 0
  results.push({
    ok:
      adminRoot.status === 200 &&
      sistemasRoot.status === 200 &&
      sistemasCount >= 15 &&
      sistemasCount === adminCount,
    label: 'sistemas.ti ve las mismas carpetas raíz que admin@',
    detail: `admin=${adminCount} sistemas.ti=${sistemasCount} HTTP ${sistemasRoot.status}`,
  })

  const userRoot = await api(regular.idToken, 'GET', '/api/drive/files?folderId=root')
  const userFolder = await api(
    regular.idToken,
    'GET',
    `/api/drive/files?folderId=${TEST_FOLDER_ID}`,
  )
  const scopedOk =
    userFolder.status === 200 &&
    (userRoot.status === 403 ||
      userRoot.status === 404 ||
      (userRoot.status === 200 && (userRoot.body?.files?.length ?? 0) < adminCount))
  results.push({
    ok: scopedOk,
    label: 'Usuario común no hereda la vista completa de super_admin',
    detail:
      `raíz HTTP ${userRoot.status} (${userRoot.body?.files?.length ?? 0}/${adminCount}); ` +
      `_pruebas HTTP ${userFolder.status}`,
  })

  const created = await api(sistemas.idToken, 'POST', '/api/drive/files', {
    name: `Salvaguarda super_admin ${Date.now()}`,
    type: 'google_doc',
    parentFolderId: TEST_FOLDER_ID,
    classification: 'USO_INTERNO',
    reason: REASON,
  })
  const fileId = created.body?.id ?? null
  results.push({
    ok: created.status === 201 && Boolean(fileId),
    label: 'sistemas.ti puede crear en carpeta accesible vía datos@',
    detail: `HTTP ${created.status}; id=${fileId ?? '?'}`,
  })

  const trashed = fileId
    ? await api(sistemas.idToken, 'POST', `/api/drive/files/${fileId}/trash`, {
        reason: REASON,
      })
    : { status: 0, body: { error: 'sin fileId' } }
  results.push({
    ok: trashed.status === 200 && trashed.body?.trashed === true,
    label: 'sistemas.ti puede enviar a papelera vía datos@',
    detail: `HTTP ${trashed.status}`,
  })

  console.log('--- Salvaguarda super_admin Drive subject ---')
  for (const result of results) {
    console.log(line(result.ok, result.label, result.detail))
  }
  console.log('')
  console.log(`admin@: ${admin.email} (${adminCount} ítems raíz)`)
  console.log(`sistemas.ti@: ${sistemas.email} (${sistemasCount} ítems raíz)`)
  console.log(`usuario común: ${regular.email} (${regular.role})`)
  console.log('')

  const ok = results.every((result) => result.ok)
  console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: con fallos')
  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
