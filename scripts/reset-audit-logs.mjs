/**
 * Vacía la colección `auditLogs` (esquema unificado; no hay migración de campos).
 *
 * Uso:
 *   node scripts/reset-audit-logs.mjs --dry-run
 *   node scripts/reset-audit-logs.mjs --archive
 *   node scripts/reset-audit-logs.mjs
 *
 * `--archive` copia cada documento a `auditLogs_archive_<YYYYMMDD>` antes de borrar.
 *
 * Requiere GOOGLE_APPLICATION_CREDENTIALS o ADC (Firebase Admin).
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SOURCE = 'auditLogs'
const dryRun = process.argv.includes('--dry-run')
const archive = process.argv.includes('--archive')

function archiveCollectionName() {
  const day = new Date().toISOString().slice(0, 10).replaceAll('-', '')
  return `auditLogs_archive_${day}`
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
  const destName = archiveCollectionName()

  console.log(
    dryRun
      ? '=== DRY-RUN: no se escribe ni borra ==='
      : archive
        ? `=== ARCHIVO + DELETE: copia en ${destName} y se vacía ${SOURCE} ===`
        : `=== DELETE: se vacía ${SOURCE} (sin copia) ===`,
  )

  const snapshot = await db.collection(SOURCE).get()
  console.log(`Documentos en ${SOURCE}: ${snapshot.size}`)

  if (snapshot.empty) {
    console.log('Nada que hacer.')
    return
  }

  if (dryRun) {
    snapshot.docs.slice(0, 5).forEach((docSnap) => {
      console.log(`  ${docSnap.id}`, Object.keys(docSnap.data()).join(', '))
    })
    if (snapshot.size > 5) console.log(`  … y ${snapshot.size - 5} más`)
    return
  }

  const BATCH_SIZE = 400
  let archived = 0
  let deleted = 0

  for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
    const chunk = snapshot.docs.slice(i, i + BATCH_SIZE)
    const batch = db.batch()

    for (const docSnap of chunk) {
      if (archive) {
        batch.set(db.collection(destName).doc(docSnap.id), {
          ...docSnap.data(),
          _archivedAt: new Date(),
        })
        archived += 1
      }
      batch.delete(docSnap.ref)
      deleted += 1
    }

    await batch.commit()
  }

  console.log(
    archive
      ? `Listo. Archivados: ${archived}. Borrados de ${SOURCE}: ${deleted}.`
      : `Listo. Borrados de ${SOURCE}: ${deleted}.`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
