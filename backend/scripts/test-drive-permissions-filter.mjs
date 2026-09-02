/**
 * Verifica que jefes de área no vean datos@ ni super_admin en GET permissions.
 *
 *   npm run test:drive:permissions-filter
 */

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, getTestIdToken } from './get-test-token.mjs'

const SISTEMAS_DRIVE = '188-zgNhMIfeUjAI8GracINlItBbFwoUb'
const DEFAULT_EMAIL = 'implementaciones.it@bacarsa.com.ar'
const REASON =
  'Prueba de filtro de permisos privilegiados en modal de acceso Drive Bacar'

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

async function privilegedEmails() {
  const db = getAdminDb()
  const envEmail = (process.env.DRIVE_IMPERSONATE_EMAIL ?? 'datos@bacarsa.com.ar')
    .trim()
    .toLowerCase()
  const emails = new Set([envEmail])
  const snap = await db.collection('users').where('role', '==', 'super_admin').get()
  for (const doc of snap.docs) {
    const email = doc.get('email')
    if (typeof email === 'string' && email.trim()) {
      emails.add(email.trim().toLowerCase())
    }
  }
  return emails
}

function permissionEmails(body) {
  return (body?.permissions ?? [])
    .map((row) => String(row.emailAddress ?? '').trim().toLowerCase())
    .filter(Boolean)
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
  const beforeAreas = Array.isArray(beforeSnap.get('managedAreaIds'))
    ? [...beforeSnap.get('managedAreaIds')]
    : []

  const privileged = await privilegedEmails()
  console.log(`super_admin: ${admin.email}`)
  console.log(`jefe de prueba: ${chief.email}`)
  console.log(`emails privilegiados (${privileged.size}): ${[...privileged].join(', ')}`)
  console.log('')

  let fileId = null
  const results = []

  try {
    const created = await api(admin.idToken, 'POST', '/api/drive/files', {
      name: `Prueba filtro permisos ${Date.now()}`,
      type: 'google_doc',
      parentFolderId: SISTEMAS_DRIVE,
      reason: REASON,
      classification: 'USO_INTERNO',
    })
    fileId = created.body?.id ?? null
    if (!fileId) {
      throw new Error(`No se pudo crear archivo de prueba: HTTP ${created.status}`)
    }

    await userRef.set(
      {
        role: 'admin',
        managedAreaIds: FieldValue.arrayUnion(created.body.governingAreaId),
      },
      { merge: true },
    )

    const adminList = await api(admin.idToken, 'GET', `/api/drive/files/${fileId}/permissions`)
    const chiefList = await api(chief.idToken, 'GET', `/api/drive/files/${fileId}/permissions`)

    const adminEmails = permissionEmails(adminList.body)
    const chiefEmails = permissionEmails(chiefList.body)
    const hiddenForChief = adminEmails.filter((email) => !chiefEmails.includes(email))
    const leakedPrivileged = chiefEmails.filter((email) => privileged.has(email))

    results.push({
      ok: adminList.status === 200,
      label: 'super_admin puede listar permisos',
      detail: `HTTP ${adminList.status}; count=${adminEmails.length}`,
    })
    results.push({
      ok: chiefList.status === 200,
      label: 'jefe de área puede listar permisos',
      detail: `HTTP ${chiefList.status}; count=${chiefEmails.length}`,
    })
    results.push({
      ok: leakedPrivileged.length === 0,
      label: 'jefe no ve emails privilegiados',
      detail:
        leakedPrivileged.length > 0
          ? `filtrados mal: ${leakedPrivileged.join(', ')}`
          : `ocultos: ${hiddenForChief.join(', ') || '(ninguno extra vs jefe)'}`,
    })
    results.push({
      ok: adminEmails.length >= chiefEmails.length,
      label: 'super_admin ve igual o más entradas que el jefe',
      detail: `admin=${adminEmails.length}, jefe=${chiefEmails.length}`,
    })
  } finally {
    if (beforeAreas.length > 0) {
      await userRef.set({ managedAreaIds: beforeAreas }, { merge: true })
    } else {
      await userRef.update({ managedAreaIds: FieldValue.delete() })
    }
    if (fileId) {
      await api(admin.idToken, 'POST', `/api/drive/files/${fileId}/trash`, {
        reason: REASON,
      })
    }
  }

  console.log('--- Filtro permisos privilegiados ---')
  for (const row of results) {
    console.log(`${row.ok ? 'OK  ' : 'FAIL'}  ${row.label}${row.detail ? ` — ${row.detail}` : ''}`)
  }
  const failed = results.filter((row) => !row.ok).length
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
