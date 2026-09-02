/**
 * Elimina `rootAreaId` de folders y resourceItems. Solo si `governingAreaId`
 * está seteado y coincide (no borra el campo de gobernanza).
 *
 *   node scripts/remove-root-area-id.mjs --dry-run
 *   node scripts/remove-root-area-id.mjs
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const dryRun = process.argv.includes('--dry-run')
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SAMPLE_SIZE = 5

function loadBackendEnv() {
  const envPath = resolve(ROOT, 'backend/.env')
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function initAdmin() {
  if (getApps().length > 0) return
  loadBackendEnv()
  const credPath = process.env.ADMIN_SDK_KEY_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS
  if (credPath) {
    const serviceAccount = JSON.parse(readFileSync(resolve(credPath), 'utf8'))
    initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    })
    return
  }
  initializeApp({ credential: applicationDefault() })
}

function asId(value) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

async function reportCollection(db, name) {
  const snap = await db.collection(name).get()
  let withRoot = 0
  let withGoverning = 0
  let willDelete = 0
  let skippedMismatch = 0
  let skippedNoGoverning = 0
  let alreadyClean = 0
  const samples = []

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const root = asId(data.rootAreaId)
    const governing = asId(data.governingAreaId)
    if (governing) withGoverning += 1
    if (!root) {
      alreadyClean += 1
      continue
    }
    withRoot += 1
    if (!governing) {
      skippedNoGoverning += 1
      continue
    }
    if (governing !== root) {
      skippedMismatch += 1
      continue
    }
    willDelete += 1
    if (samples.length < SAMPLE_SIZE) {
      samples.push({
        collection: name,
        id: docSnap.id,
        name: typeof data.name === 'string' ? data.name : '(sin name)',
        antes: { rootAreaId: root, governingAreaId: governing },
        despues: { rootAreaId: '(eliminado)', governingAreaId: governing },
      })
    }
  }

  return {
    collection: name,
    total: snap.size,
    withRootAreaId: withRoot,
    withGoverningAreaId: withGoverning,
    willDeleteRootAreaId: willDelete,
    skippedNoGoverning,
    skippedMismatch,
    alreadyClean,
    samples,
  }
}

async function applyCollection(db, name) {
  const snap = await db.collection(name).get()
  let updated = 0
  const BATCH = 400
  let batch = db.batch()
  let inBatch = 0

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const root = asId(data.rootAreaId)
    const governing = asId(data.governingAreaId)
    if (!root || !governing || governing !== root) continue

    batch.update(docSnap.ref, { rootAreaId: FieldValue.delete() })
    inBatch += 1
    updated += 1
    if (inBatch >= BATCH) {
      await batch.commit()
      batch = db.batch()
      inBatch = 0
    }
  }
  if (inBatch > 0) await batch.commit()
  return updated
}

async function main() {
  initAdmin()
  const db = getFirestore()

  const folders = await reportCollection(db, 'folders')
  const items = await reportCollection(db, 'resourceItems')

  console.log(JSON.stringify({ folders, resourceItems: items, dryRun }, null, 2))

  const blocked = folders.skippedMismatch + folders.skippedNoGoverning
    + items.skippedMismatch + items.skippedNoGoverning
  if (blocked > 0) {
    console.error('Hay documentos inseguros para borrar rootAreaId. Abortando write.')
    process.exit(1)
  }

  if (dryRun) {
    console.log('DRY-RUN: no se escribió nada.')
    return
  }

  const fu = await applyCollection(db, 'folders')
  const iu = await applyCollection(db, 'resourceItems')
  console.log(`Eliminado rootAreaId: folders=${fu} resourceItems=${iu}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
