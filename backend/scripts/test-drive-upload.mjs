/**
 * Multipart real (PNG) → Drive → sidecar/list → trash sin motivo.
 *
 *   npm run test:drive:upload
 */

import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const SISTEMAS_DRIVE = '188-zgNhMIfeUjAI8GracINlItBbFwoUb'
const SISTEMAS_AREA = 'r7QVKsrSiqDWC8DrXCac'
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

function apiBase() {
  return (
    process.env.FUNCTIONS_API_BASE?.trim() ||
    'http://127.0.0.1:5001/bacar-web/southamerica-east1/api'
  )
}

async function main() {
  process.env.TEST_EMAIL = 'admin@bacarsa.com.ar'
  const user = await getTestIdToken()
  const name = `Prueba upload ${Date.now()}.png`
  const form = new FormData()
  form.set('file', new Blob([Buffer.from(PNG_1X1, 'base64')], { type: 'image/png' }), name)
  form.set('parentFolderId', SISTEMAS_DRIVE)
  form.set('classification', 'CONFIDENCIAL')
  form.set('reason', 'Prueba de subida multipart real a la unidad compartida')

  const uploaded = await fetch(`${apiBase()}/api/drive/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.idToken}` },
    body: form,
  })
  const body = await uploaded.json().catch(() => ({}))
  const id = body.id
  console.log('upload', uploaded.status, JSON.stringify(body))

  const sidecar = id
    ? await getAdminDb().collection('driveFiles').doc(id).get()
    : null
  const listed = await fetch(
    `${apiBase()}/api/drive/files?folderId=${SISTEMAS_DRIVE}`,
    { headers: { Authorization: `Bearer ${user.idToken}` } },
  )
  const listedBody = await listed.json().catch(() => ({}))
  const item = listedBody.files?.find((file) => file.id === id)

  const trashed = id
    ? await fetch(`${apiBase()}/api/drive/files/${id}/trash`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.idToken}`,
          'Content-Type': 'application/json',
        },
        body: '{}',
      })
    : null
  const trashBody = trashed ? await trashed.json().catch(() => ({})) : {}

  const checks = [
    ['upload 201', uploaded.status === 201],
    ['mime PNG', body.mimeType === 'image/png'],
    ['área correcta', body.governingAreaId === SISTEMAS_AREA],
    ['sidecar clasificación', sidecar?.get('classification') === 'CONFIDENCIAL'],
    ['creador exacto', item?.creator?.source === 'intranet'],
    ['ownerLabel', item?.ownerLabel === `Sistemas - ${body.createdBy?.displayName}`],
    ['trash PNG sin motivo', trashed?.status === 200 && trashBody.trashed === true],
  ]
  for (const [label, ok] of checks) console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

