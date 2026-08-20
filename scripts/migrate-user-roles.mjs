/**
 * One-shot migration: assign UserProfile.role on Firestore `users`.
 *
 * Usage:
 *   node scripts/migrate-user-roles.mjs --dry-run
 *   node scripts/migrate-user-roles.mjs
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS pointing to a service account JSON
 * (keep the file outside git; see .gitignore).
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SUPER_ADMIN_EMAILS = new Set([
  'admin@bacarsa.com.ar',
  'sistemas.ti@bacarsa.com.ar',
])

const USERS_COLLECTION = 'users'
const dryRun = process.argv.includes('--dry-run')

function resolveTargetRole(email) {
  const normalized = (email ?? '').trim().toLowerCase()
  return SUPER_ADMIN_EMAILS.has(normalized) ? 'super_admin' : 'user'
}

function initAdmin() {
  if (getApps().length > 0) return

  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credPath) {
    const absolute = resolve(credPath)
    const serviceAccount = JSON.parse(readFileSync(absolute, 'utf8'))
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
    return
  }

  initializeApp({ credential: applicationDefault() })
}

async function main() {
  initAdmin()
  const db = getFirestore()

  console.log(
    dryRun
      ? '=== DRY-RUN: no se escribe en Firestore ==='
      : '=== MIGRACIÓN REAL: se actualizarán documentos ===',
  )

  const snapshot = await db.collection(USERS_COLLECTION).get()

  let wouldChange = 0
  let updated = 0
  let skipped = 0
  let errors = 0

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data()
    const email = typeof data.email === 'string' ? data.email : ''
    const currentRole =
      typeof data.role === 'string' && data.role.length > 0 ? data.role : '(sin role)'
    const targetRole = resolveTargetRole(email)

    if (currentRole === targetRole) {
      skipped += 1
      continue
    }

    wouldChange += 1
    console.log(`${docSnap.id} | ${email || '(sin email)'} | ${currentRole} -> ${targetRole}`)

    if (dryRun) continue

    try {
      await docSnap.ref.update({ role: targetRole })
      updated += 1
    } catch (err) {
      errors += 1
      console.error(`  ERROR en ${docSnap.id}:`, err instanceof Error ? err.message : err)
    }
  }

  console.log('---')
  console.log(`Total docs:     ${snapshot.size}`)
  if (dryRun) {
    console.log(`Cambiarían:     ${wouldChange}`)
    console.log(`Sin cambios:    ${skipped}`)
  } else {
    console.log(`Actualizados:   ${updated}`)
    console.log(`Skipped:        ${skipped}`)
    console.log(`Errores:        ${errors}`)
  }
}

main().catch((err) => {
  console.error('Migración fallida:', err)
  process.exitCode = 1
})
