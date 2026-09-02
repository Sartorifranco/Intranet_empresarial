/**
 * Migra acceso inicial de tableros: copia la lista Gerencia a cada tablero existente.
 *
 *   npm run boards:access:seed:dry-run
 *   npm run boards:access:seed
 */

import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { getAdminDb, initAdmin, loadTestEnv } from './get-test-token.mjs'
import { getDrive } from '../lib/lib/google/driveClient.js'

const dryRun = !process.argv.includes('--apply')
const listUsers = process.argv.includes('--list-users')

const GERENCIA_AREA_ID = process.env.BOARDS_GOVERNING_AREA_ID?.trim() || 'MM25DIlzctON9kegb4MF'

const GERENCIA_EMAILS = [
  'ivan.barrera@bacarsa.com.ar',
  'administracion@bacarsa.com.ar',
  'pablo.magnin@bacarsa.com.ar',
  'eduardo.asinardi@bacarsa.com.ar',
  'creartes@bacarsa.com.ar',
]

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const BOARD_ACCESS_COLLECTION = 'boardAccess'

async function listBoardFolders(containerId) {
  const drive = await getDrive()
  const listed = await drive.files.list({
    q: `'${containerId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
    fields: 'files(id, name)',
    orderBy: 'name_natural',
    pageSize: 50,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  })
  return (listed.data.files ?? []).filter((file) => file.id && file.name)
}

async function resolveGrantees(db) {
  const byUid = new Map()
  const allUsers = await db.collection('users').get()

  for (const doc of allUsers.docs) {
    const emailRaw = doc.get('email')
    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : ''
    const managedRaw = doc.get('managedAreaIds')
    const managedAreaIds = Array.isArray(managedRaw)
      ? managedRaw.filter((id) => typeof id === 'string')
      : []
    const inGerenciaArea = managedAreaIds.includes(GERENCIA_AREA_ID)
    const inSeedList = email && GERENCIA_EMAILS.includes(email)
    if (!inGerenciaArea && !inSeedList) continue

    const displayName =
      (typeof doc.get('displayName') === 'string' && doc.get('displayName').trim()) || email || doc.id
    byUid.set(doc.id, {
      uid: doc.id,
      email: email || '(sin email)',
      displayName,
      source: inSeedList && inGerenciaArea ? 'seed+area' : inSeedList ? 'seed' : 'area',
    })
  }

  const grantees = [...byUid.values()]
  const missing = GERENCIA_EMAILS.filter(
    (email) => !grantees.some((row) => row.email === email),
  ).map((email) => ({ email, reason: 'sin documento en users/ (se usan jefes de área si existen)' }))

  return { grantees, missing }
}

async function main() {
  loadTestEnv()
  initAdmin()

  const containerId = process.env.BOARDS_CONTAINER_FOLDER_ID?.trim()
  if (!containerId) {
    throw new Error('Definí BOARDS_CONTAINER_FOLDER_ID en backend/.env o .env.local')
  }

  const db = getAdminDb()

  if (listUsers) {
    const snap = await db.collection('users').get()
    console.log(`users/${snap.size}`)
    for (const doc of snap.docs) {
      console.log(
        doc.id,
        doc.get('email'),
        doc.get('role'),
        JSON.stringify(doc.get('managedAreaIds') ?? []),
      )
    }
    return
  }

  console.log(
    dryRun
      ? '=== DRY-RUN: no se escribe boardAccess ==='
      : '=== APPLY: escritura real en boardAccess ===',
  )
  console.log('contenedor', containerId)

  const boards = await listBoardFolders(containerId)
  console.log(`tableros encontrados: ${boards.length}`)
  for (const board of boards) {
    console.log(`  - ${board.name} (${board.id})`)
  }

  const { grantees, missing } = await resolveGrantees(db)
  console.log(`\nusuarios a migrar: ${grantees.length}`)
  for (const row of grantees) {
    console.log(`  OK  ${row.email} → ${row.uid} (${row.source})`)
  }
  if (missing.length > 0) {
    console.log(`\nEmails del seed sin cuenta en intranet (${missing.length}):`)
    for (const row of missing) {
      console.log(`  WARN ${row.email} (${row.reason})`)
    }
  }

  if (grantees.length === 0) {
    console.error('\nAbortando: no hay usuarios para migrar.')
    process.exit(1)
  }

  for (const board of boards) {
    const ref = db.collection(BOARD_ACCESS_COLLECTION).doc(board.id)
    const existing = await ref.get()
    const existingUsers = existing.exists && Array.isArray(existing.get('allowedUsers'))
      ? existing.get('allowedUsers')
      : []
    const existingIds = new Set(
      existingUsers
        .map((row) => (row && typeof row.uid === 'string' ? row.uid : null))
        .filter(Boolean),
    )

    const toAdd = grantees.filter((row) => !existingIds.has(row.uid))
    const mergedIds = [...new Set([...existingIds, ...grantees.map((row) => row.uid)])]

    console.log(`\n[${board.name}]`)
    console.log(`  existentes: ${existingIds.size}`)
    console.log(`  a agregar: ${toAdd.length}`)
    console.log(`  total final: ${mergedIds.size}`)

    if (toAdd.length === 0) {
      console.log('  SKIP (ya migrado)')
      continue
    }

    const allowedUsers = [
      ...existingUsers.filter((row) => row && typeof row.uid === 'string'),
      ...toAdd.map((row) => ({
        uid: row.uid,
        email: row.email,
        displayName: row.displayName,
        grantedAt: Timestamp.now(),
        grantedBy: {
          uid: 'migration',
          email: 'scripts/seed-board-access.mjs',
        },
      })),
    ]

    const payload = {
      boardFolderId: board.id,
      boardName: board.name,
      allowedUsers,
      allowedUserIds: mergedIds,
      updatedAt: FieldValue.serverTimestamp(),
      updatedByUserId: 'migration',
      updatedByEmail: 'scripts/seed-board-access.mjs',
    }

    if (dryRun) {
      console.log(`  DRY-RUN set boardAccess/${board.id}`)
      for (const row of toAdd) console.log(`    + ${row.email}`)
    } else {
      await ref.set(payload, { merge: true })
      console.log('  APPLY ok')
    }
  }

  console.log(dryRun ? '\nDry-run completo.' : '\nMigración aplicada.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
