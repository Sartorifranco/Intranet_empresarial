/**
 * Copia `rootAreaId` → `governingAreaId` en folders y resourceItems.
 * No borra `rootAreaId` (limpieza posterior, aparte).
 *
 *   node scripts/backfill-governing-area-id.mjs --dry-run
 *   node scripts/backfill-governing-area-id.mjs
 *
 * Credenciales: ADMIN_SDK_KEY_PATH (backend/.env), GOOGLE_APPLICATION_CREDENTIALS, o ADC.
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
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
  let needsCopy = 0
  let alreadyOk = 0
  let missingBoth = 0
  const samples = []

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const root = asId(data.rootAreaId)
    const governing = asId(data.governingAreaId)
    if (root) withRoot += 1
    if (governing) withGoverning += 1
    if (!root && !governing) missingBoth += 1

    const wouldSet = root && governing !== root
    if (wouldSet) {
      needsCopy += 1
      if (samples.length < SAMPLE_SIZE) {
        samples.push({
          collection: name,
          id: docSnap.id,
          name: typeof data.name === 'string' ? data.name : '(sin name)',
          antes: { rootAreaId: root, governingAreaId: governing },
          despues: { rootAreaId: root, governingAreaId: root },
        })
      }
    } else if (root && governing === root) {
      alreadyOk += 1
    }
  }

  return {
    collection: name,
    total: snap.size,
    withRootAreaId: withRoot,
    withGoverningAreaId: withGoverning,
    needsCopy,
    alreadyMatching: alreadyOk,
    missingBoth,
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
    if (!root || governing === root) continue

    batch.update(docSnap.ref, { governingAreaId: root })
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

  if (dryRun) {
    console.log('DRY-RUN: no se escribió nada.')
    return
  }

  const fu = await applyCollection(db, 'folders')
  const iu = await applyCollection(db, 'resourceItems')
  console.log(`Escritos: folders=${fu} resourceItems=${iu} (rootAreaId intacto)`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
