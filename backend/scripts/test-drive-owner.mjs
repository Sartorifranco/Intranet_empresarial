/**
 * Contrato Área - Creador para archivos creados desde la intranet.
 *
 *   npm run test:drive:owner
 */

import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const SISTEMAS_DRIVE = '188-zgNhMIfeUjAI8GracINlItBbFwoUb'
const SISTEMAS_AREA = 'r7QVKsrSiqDWC8DrXCac'
const REASON = 'Prueba del formato de área y creador real en Drive'

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
  const payload = await res.json().catch(() => ({}))
  return { status: res.status, body: payload }
}

async function main() {
  process.env.TEST_EMAIL = 'admin@bacarsa.com.ar'
  const user = await getTestIdToken()

  const created = await api(user.idToken, 'POST', '/api/drive/files', {
    name: `Prueba propietario ${Date.now()}`,
    type: 'google_doc',
    parentFolderId: SISTEMAS_DRIVE,
    classification: 'USO_INTERNO',
    reason: REASON,
  })
  const fileId = created.body?.id
  if (created.status !== 201 || !fileId) {
    console.error('FAIL create', created.status, created.body)
    process.exit(1)
  }

  const listed = await api(
    user.idToken,
    'GET',
    `/api/drive/files?folderId=${SISTEMAS_DRIVE}`,
  )
  const item = listed.body?.files?.find((file) => file.id === fileId)
  const sidecar = await getAdminDb().collection('driveFiles').doc(fileId).get()

  const expectedCreator = created.body.createdBy?.displayName
  const checks = [
    ['list HTTP 200', listed.status === 200],
    ['archivo aparece', Boolean(item)],
    ['área correcta', item?.governingAreaId === SISTEMAS_AREA],
    ['nombre de área', item?.governingAreaName === 'Sistemas'],
    ['creador exacto', item?.creator?.source === 'intranet'],
    [
      'ownerLabel',
      item?.ownerLabel === `Sistemas - ${expectedCreator}`,
    ],
    ['sidecar email', sidecar.get('createdByEmail') === user.email],
  ]

  for (const [label, ok] of checks) {
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  }
  console.log(JSON.stringify(item, null, 2))

  const cleanup = await api(
    user.idToken,
    'POST',
    `/api/drive/files/${fileId}/trash`,
    { reason: 'Limpieza de la prueba de propietario del archivo' },
  )
  console.log(`${cleanup.status === 200 ? 'OK  ' : 'FAIL'} cleanup`)

  process.exit(checks.every(([, ok]) => ok) && cleanup.status === 200 ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

