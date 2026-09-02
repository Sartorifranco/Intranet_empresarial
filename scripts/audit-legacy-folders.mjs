/**
 * Auditoría legacy: folders (raíz vs anidadas), resourceItems, sharedFiles (solo lectura).
 *
 *   npm run legacy:audit
 *   npm run legacy:audit -- --export=scripts/backups/legacy-folders-audit.json
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const RECENT_DAYS = 180

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

function toIso(value) {
  if (!value) return null
  if (value instanceof Timestamp) return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') return value
  return null
}

function serializeDoc(id, data) {
  const out = { id }
  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      out[key] = value.toDate().toISOString()
    } else {
      out[key] = value
    }
  }
  return out
}

function isRootFolder(data) {
  const parent = data.parentFolderId
  return parent === null || parent === undefined || parent === ''
}

async function auditFolders(db) {
  const snap = await db.collection('folders').get()
  const roots = []
  const nested = []

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const row = {
      id: docSnap.id,
      name: typeof data.name === 'string' ? data.name : null,
      parentFolderId: data.parentFolderId ?? null,
      governingAreaId: data.governingAreaId ?? null,
      allowedUsersCount: Array.isArray(data.allowedUsers) ? data.allowedUsers.length : 0,
      createdAt: toIso(data.createdAt),
    }
    if (isRootFolder(data)) roots.push(row)
    else nested.push(row)
  }

  roots.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'))
  nested.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'))

  return { total: snap.size, roots, nested }
}

async function auditResourceItems(db) {
  const snap = await db.collection('resourceItems').get()
  const items = snap.docs.map((docSnap) => {
    const data = docSnap.data()
    return {
      id: docSnap.id,
      name: typeof data.name === 'string' ? data.name : null,
      type: data.type ?? null,
      folderId: data.folderId ?? null,
      governingAreaId: data.governingAreaId ?? null,
      allowedUsersCount: Array.isArray(data.allowedUsers) ? data.allowedUsers.length : 0,
      createdAt: toIso(data.createdAt),
    }
  })
  items.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'es'))
  return { total: snap.size, items }
}

async function auditSharedFiles(db) {
  const snap = await db.collection('sharedFiles').get()
  const cutoff = Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000
  const docs = []
  let withUpdatedAt = 0
  let recentUpdatedAt = 0
  let newestUpdatedAt = null
  let newestTitle = null

  for (const docSnap of snap.docs) {
    const data = docSnap.data()
    const updatedIso = toIso(data.updatedAt)
    const createdIso = toIso(data.createdAt)
    const updatedMs = updatedIso ? Date.parse(updatedIso) : null

    if (updatedIso) withUpdatedAt += 1
    if (updatedMs && updatedMs >= cutoff) recentUpdatedAt += 1
    if (updatedMs && (!newestUpdatedAt || updatedMs > Date.parse(newestUpdatedAt))) {
      newestUpdatedAt = updatedIso
      newestTitle = typeof data.title === 'string' ? data.title : docSnap.id
    }

    docs.push({
      id: docSnap.id,
      title: typeof data.title === 'string' ? data.title : null,
      department: data.department ?? null,
      type: data.type ?? null,
      allowedUsersCount: Array.isArray(data.allowedUsers) ? data.allowedUsers.length : 0,
      createdAt: createdIso,
      updatedAt: updatedIso,
    })
  }

  docs.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '', 'es'))

  return {
    total: snap.size,
    withUpdatedAt,
    recentUpdatedAtWithinDays: recentUpdatedAt,
    recentWindowDays: RECENT_DAYS,
    newestUpdatedAt,
    newestTitle,
    docs,
  }
}

function parseExportArg() {
  const arg = process.argv.find((value) => value.startsWith('--export='))
  if (!arg) return null
  return resolve(ROOT, arg.slice('--export='.length))
}

async function main() {
  initAdmin()
  const db = getFirestore()

  const [folders, resourceItems, sharedFiles] = await Promise.all([
    auditFolders(db),
    auditResourceItems(db),
    auditSharedFiles(db),
  ])

  const report = {
    generatedAt: new Date().toISOString(),
    project: process.env.GCLOUD_PROJECT ?? process.env.GCP_PROJECT ?? 'bacar-web',
    folders: {
      total: folders.total,
      rootCount: folders.roots.length,
      nestedCount: folders.nested.length,
      roots: folders.roots,
      nested: folders.nested,
      purgePlan: {
        keep: folders.roots.map((row) => row.id),
        deleteNestedIds: folders.nested.map((row) => row.id),
      },
    },
    resourceItems: {
      total: resourceItems.total,
      items: resourceItems.items,
      purgePlan: {
        deleteAllIds: resourceItems.items.map((row) => row.id),
      },
    },
    sharedFiles: {
      note: 'Solo auditoría informativa — no se borra en esta pasada',
      ...sharedFiles,
    },
  }

  const exportPath = parseExportArg()
  if (exportPath) {
    mkdirSync(dirname(exportPath), { recursive: true })
    writeFileSync(exportPath, JSON.stringify(report, null, 2), 'utf8')
    console.error(`Export: ${exportPath}`)
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
