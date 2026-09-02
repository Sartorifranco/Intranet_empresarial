/**
 * Solo lectura: hijos de primer nivel de la Unidad compartida + carpetas raíz de Firestore.
 * Sugiere pares por nombre; NUNCA escribe driveFolderAreas.
 *
 *   npm run drive-areas:suggest
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const SHARED_NAME = 'compartido entre áreas'

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

function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

async function listDriveTopLevel() {
  loadBackendEnv()
  const { getDrive } = await import(
    pathToFileURL(resolve(ROOT, 'backend/lib/lib/google/driveClient.js')).href
  )
  const { getSharedDriveQuery, getSharedDriveRootId } = await import(
    pathToFileURL(resolve(ROOT, 'backend/lib/lib/google/sharedDrive.js')).href
  )
  const driveId = getSharedDriveRootId()
  const drive = await getDrive()
  const shared = getSharedDriveQuery()
  const folders = []
  const otherItems = []
  let pageToken
  do {
    const result = await drive.files.list({
      q: `'${driveId}' in parents and trashed = false`,
      fields: 'nextPageToken, files(id, name, mimeType)',
      pageSize: 100,
      pageToken,
      orderBy: 'name',
      ...shared,
    })
    for (const file of result.data.files ?? []) {
      if (!file.id || !file.name) continue
      if (file.mimeType === FOLDER_MIME) folders.push({ id: file.id, name: file.name })
      else otherItems.push({ id: file.id, name: file.name, mimeType: file.mimeType ?? '' })
    }
    pageToken = result.data.nextPageToken ?? undefined
  } while (pageToken)
  folders.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  const driveMeta = await drive.drives.get({ driveId })
  return { driveId, driveName: driveMeta.data.name ?? '', folders, otherItems }
}

async function listFirestoreRoots(db) {
  const snap = await db.collection('folders').where('parentFolderId', '==', null).get()
  const folders = snap.docs.map((docSnap) => ({
    id: docSnap.id,
    name: String(docSnap.get('name') ?? ''),
  }))
  folders.sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return folders
}

function suggestPairs(driveFolders, firestoreFolders) {
  const byName = new Map()
  for (const folder of firestoreFolders) {
    const key = normalizeName(folder.name)
    const list = byName.get(key) ?? []
    list.push(folder)
    byName.set(key, list)
  }

  const suggested = []
  const ambiguous = []
  const unmatchedDrive = []
  const skipShared = []
  const usedIds = new Set()

  for (const drive of driveFolders) {
    if (normalizeName(drive.name) === SHARED_NAME) {
      skipShared.push(drive)
      continue
    }
    const key = normalizeName(drive.name)
    const candidates = byName.get(key) ?? []
    if (candidates.length === 1) {
      suggested.push({ drive, area: candidates[0] })
      usedIds.add(candidates[0].id)
    } else if (candidates.length > 1) {
      ambiguous.push({ drive, candidates })
    } else {
      unmatchedDrive.push(drive)
    }
  }

  return {
    suggested,
    ambiguous,
    unmatchedDrive,
    unmatchedFirestore: firestoreFolders.filter((folder) => !usedIds.has(folder.id)),
    skipShared,
  }
}

async function main() {
  initAdmin()
  const db = getFirestore()
  const { driveId, driveName, folders: driveFolders, otherItems } = await listDriveTopLevel()
  const firestoreFolders = await listFirestoreRoots(db)
  const { suggested, ambiguous, unmatchedDrive, unmatchedFirestore, skipShared } = suggestPairs(
    driveFolders,
    firestoreFolders,
  )

  console.log(`Unidad compartida: "${driveName}" [${driveId}]`)
  console.log(`Carpetas Drive (primer nivel): ${driveFolders.length}`)
  if (otherItems.length > 0) {
    console.log(`Otros ítems en la raíz (no carpetas): ${otherItems.length}`)
    for (const item of otherItems) {
      console.log(`  - "${item.name}" [${item.id}] ${item.mimeType}`)
    }
  }
  console.log(`Carpetas Firestore (parentFolderId=null): ${firestoreFolders.length}`)
  console.log('')
  console.log('=== Sugerencias por nombre (NO escritas) ===')
  if (suggested.length === 0) {
    console.log('(ninguna coincidencia exacta de nombre)')
  }
  for (const pair of suggested) {
    console.log(
      `CONFIRMAR  Drive "${pair.drive.name}" [${pair.drive.id}]  →  área Firestore "${pair.area.name}" [${pair.area.id}]`,
    )
  }
  console.log('')
  console.log('=== Ambiguos (mismo nombre en más de un folder raíz; no se elige solo) ===')
  if (ambiguous.length === 0) console.log('(ninguno)')
  for (const row of ambiguous) {
    const ids = row.candidates.map((c) => `"${c.name}" [${c.id}]`).join(' | ')
    console.log(`AMBIGUO   Drive "${row.drive.name}" [${row.drive.id}]  candidatos: ${ids}`)
  }
  console.log('')
  console.log('=== Sugerido SIN mapear (Compartido entre áreas) ===')
  if (skipShared.length === 0) console.log('(no aparece en Drive)')
  for (const folder of skipShared) {
    console.log(`SIN MAPEAR  Drive "${folder.name}" [${folder.id}]`)
  }
  console.log('')
  console.log('=== Drive sin par en Firestore ===')
  if (unmatchedDrive.length === 0) console.log('(ninguna)')
  for (const folder of unmatchedDrive) {
    console.log(`SIN PAR     Drive "${folder.name}" [${folder.id}]`)
  }
  console.log('')
  console.log('=== Firestore raíz sin par en Drive ===')
  if (unmatchedFirestore.length === 0) console.log('(ninguna)')
  for (const folder of unmatchedFirestore) {
    console.log(`SIN PAR     Firestore "${folder.name}" [${folder.id}]`)
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
