/**
 * Aprobación por área gobernante (no solo super_admin).
 *
 *   npm run test:drive:approval
 *
 * TEST_EMAIL = usuario no super_admin (default: implementaciones.it@...).
 * Se le asigna Sistemas solo durante la prueba y se restaura managedAreaIds/role.
 */

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const SISTEMAS_DRIVE = '188-zgNhMIfeUjAI8GracINlItBbFwoUb'
const SISTEMAS_AREA = 'r7QVKsrSiqDWC8DrXCac'
const DEFAULT_EMAIL = 'implementaciones.it@bacarsa.com.ar'
const REASON = 'Aprobacion de prueba por jefe de area segun politica de datos'

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

async function main() {
  const chiefEmail = (process.env.TEST_EMAIL?.trim() || DEFAULT_EMAIL).toLowerCase()
  process.env.TEST_EMAIL = 'admin@bacarsa.com.ar'
  const admin = await getTestIdToken()
  process.env.TEST_EMAIL = chiefEmail
  const chief = await getTestIdToken({ requireSuperAdmin: false })
  const db = getAdminDb()
  const userRef = db.collection('users').doc(chief.uid)
  const beforeSnap = await userRef.get()
  const beforeRole = beforeSnap.get('role') ?? null
  const beforeAreas = Array.isArray(beforeSnap.get('managedAreaIds'))
    ? [...beforeSnap.get('managedAreaIds')]
    : []

  const results = []
  console.log(`super_admin: ${admin.email}`)
  console.log(`jefe de prueba: ${chief.email} (${chief.role})`)
  console.log('')

  try {
    const created = await api(admin.idToken, 'POST', '/api/drive/files', {
      name: `Prueba aprobación área ${Date.now()}`,
      type: 'google_doc',
      parentFolderId: SISTEMAS_DRIVE,
      reason: REASON,
    })
    const fileId = created.body?.id ?? null
    const createOk =
      created.status === 201 &&
      Boolean(fileId) &&
      created.body?.governingAreaId === SISTEMAS_AREA
    results.push({
      ok: createOk,
      label: 'Create en Sistemas persiste governingAreaId',
      detail: `HTTP ${created.status}; governingAreaId=${created.body?.governingAreaId ?? '?'}`,
    })

    const denied = fileId
      ? await api(chief.idToken, 'PATCH', `/api/drive/files/${fileId}/status`, {
          status: 'APROBADO',
          reason: REASON,
        })
      : { status: 0, body: { error: 'sin fileId' } }
    results.push({
      ok: denied.status === 403,
      label: 'Sin el área en managedAreaIds → 403',
      detail: `HTTP ${denied.status}; ${JSON.stringify(denied.body?.error ?? denied.body)}`,
    })

    const patch = { managedAreaIds: FieldValue.arrayUnion(SISTEMAS_AREA) }
    if (beforeRole !== 'super_admin' && beforeRole !== 'admin') {
      patch.role = 'admin'
    }
    await userRef.update(patch)

    const allowed = fileId
      ? await api(chief.idToken, 'PATCH', `/api/drive/files/${fileId}/status`, {
          status: 'APROBADO',
          reason: REASON,
        })
      : { status: 0, body: { error: 'sin fileId' } }
    results.push({
      ok: allowed.status === 200 && allowed.body?.status === 'APROBADO',
      label: 'Con Sistemas en managedAreaIds → 200',
      detail: `HTTP ${allowed.status}; ${JSON.stringify(allowed.body)}`,
    })
  } finally {
    await userRef.update({
      role: beforeRole,
      managedAreaIds: beforeAreas,
    })
  }

  console.log('--- Aprobación por área ---')
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
