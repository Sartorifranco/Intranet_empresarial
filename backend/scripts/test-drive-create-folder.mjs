/**
 * POST type=folder → listado → sidecar governingAreaId → audit log → trash.
 *
 *   npm run test:drive:folder
 */

import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const SISTEMAS_DRIVE = '188-zgNhMIfeUjAI8GracINlItBbFwoUb'
const SISTEMAS_AREA = 'r7QVKsrSiqDWC8DrXCac'

function apiBase() {
  return (
    process.env.FUNCTIONS_API_BASE?.trim() ||
    'http://127.0.0.1:5001/bacar-web/southamerica-east1/api'
  )
}

async function main() {
  process.env.TEST_EMAIL = 'admin@bacarsa.com.ar'
  const user = await getTestIdToken()
  const name = `Prueba carpeta ${Date.now()}`

  const created = await fetch(`${apiBase()}/api/drive/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${user.idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      type: 'folder',
      parentFolderId: SISTEMAS_DRIVE,
      reason: 'Prueba de creación de carpeta desde la intranet',
    }),
  })
  const body = await created.json().catch(() => ({}))
  const id = body.id
  console.log('create', created.status, JSON.stringify(body))

  const sidecar = id ? await getAdminDb().collection('driveFiles').doc(id).get() : null

  const listed = await fetch(`${apiBase()}/api/drive/files?folderId=${SISTEMAS_DRIVE}`, {
    headers: { Authorization: `Bearer ${user.idToken}` },
  })
  const listedBody = await listed.json().catch(() => ({}))
  const item = listedBody.files?.find((file) => file.id === id)

  const auditSnap = await getAdminDb()
    .collection('auditLogs')
    .where('targetId', '==', id)
    .limit(5)
    .get()
  const auditEntry = auditSnap.docs.find((doc) => doc.get('action') === 'create')

  const trashed = id
    ? await fetch(`${apiBase()}/api/drive/files/${id}/trash`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${user.idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reason: 'Limpieza tras prueba de carpeta desde script',
        }),
      })
    : null
  const trashBody = trashed ? await trashed.json().catch(() => ({})) : {}

  const checks = [
    ['create 201', created.status === 201],
    ['mime carpeta', body.mimeType === 'application/vnd.google-apps.folder'],
    ['isFolder', body.isFolder === true],
    ['classification null', body.classification === null],
    ['status null', body.status === null],
    ['área correcta', body.governingAreaId === SISTEMAS_AREA],
    ['sidecar área', sidecar?.get('governingAreaId') === SISTEMAS_AREA],
    ['sidecar sin classification', sidecar?.get('classification') === undefined],
    ['listado incluye carpeta', Boolean(item?.isFolder && item?.name === name)],
    ['audit create', auditEntry?.get('action') === 'create'],
    ['audit targetType folder', auditEntry?.get('targetType') === 'folder'],
    ['trash con motivo', trashed?.status === 200 && trashBody.trashed === true],
  ]
  for (const [label, ok] of checks) console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
