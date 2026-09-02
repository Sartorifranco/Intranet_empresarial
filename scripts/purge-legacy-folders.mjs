/**
 * Elimina folders anidadas y toda resourceItems. Conserva folders raíz (catálogo de áreas).
 *
 *   npm run legacy:purge:dry-run
 *   npm run legacy:purge -- --apply
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apply = process.argv.includes('--apply')

function loadBackendEnv() {
  for (const rel of ['backend/.env.local', 'backend/.env']) {
    const envPath = resolve(ROOT, rel)
    if (!existsSync(envPath)) continue
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

function isRootFolder(data) {
  const parent = data.parentFolderId
  return parent === null || parent === undefined || parent === ''
}

async function collectTargets(db) {
  const folderSnap = await db.collection('folders').get()
  const nestedFolderIds = []
  let rootCount = 0

  for (const docSnap of folderSnap.docs) {
    if (isRootFolder(docSnap.data())) rootCount += 1
    else nestedFolderIds.push(docSnap.id)
  }

  const itemSnap = await db.collection('resourceItems').get()
  const resourceItemIds = itemSnap.docs.map((docSnap) => docSnap.id)

  return {
    rootCount,
    nestedFolderIds,
    resourceItemIds,
  }
}

async function deleteInBatches(db, collectionName, ids) {
  let deleted = 0
  const batchSize = 400
  for (let index = 0; index < ids.length; index += batchSize) {
    const chunk = ids.slice(index, index + batchSize)
    const batch = db.batch()
    for (const id of chunk) {
      batch.delete(db.collection(collectionName).doc(id))
    }
    if (apply) await batch.commit()
    deleted += chunk.length
  }
  return deleted
}

async function main() {
  initAdmin()
  const db = getFirestore()
  const targets = await collectTargets(db)

  console.log(
    apply
      ? '=== APPLY: borrando datos legacy ==='
      : '=== DRY-RUN: no se borra nada ===',
  )
  console.log(`folders raíz conservadas: ${targets.rootCount}`)
  console.log(`folders anidadas a borrar: ${targets.nestedFolderIds.length}`)
  console.log(`resourceItems a borrar: ${targets.resourceItemIds.length}`)

  if (!apply) {
    console.log('\nNested folder ids:')
    console.log(JSON.stringify(targets.nestedFolderIds, null, 2))
    console.log('\nEjecutá con --apply para borrar.')
    return
  }

  const deletedNested = await deleteInBatches(db, 'folders', targets.nestedFolderIds)
  const deletedItems = await deleteInBatches(db, 'resourceItems', targets.resourceItemIds)

  const after = await collectTargets(db)
  console.log('\nResultado:')
  console.log(`- folders anidadas borradas: ${deletedNested}`)
  console.log(`- resourceItems borrados: ${deletedItems}`)
  console.log(`- folders raíz restantes: ${after.rootCount}`)
  console.log(`- folders anidadas restantes: ${after.nestedFolderIds.length}`)
  console.log(`- resourceItems restantes: ${after.resourceItemIds.length}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
