/**
 * Crea stubs de áreas (folders raíz) y asigna jefes (managedAreaIds + role como UserManager).
 * Idempotente: reusa un stub nuevo con el mismo nombre; nunca reusa raíces legacy.
 *
 *   npm run areas:seed:dry-run
 *   npm run areas:seed
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = !process.argv.includes('--apply')

/** Raíces viejas: no reutilizar aunque el nombre coincida. */
const LEGACY_ROOT_IDS = new Set([
  'mnCpjJYbw761Mae06MQs', // Sistemas (vieja)
  'yKI3EZmt80MfTyfAdIz5', // UIF (vieja)
])

/** name exacto (raíz) → emails de jefes */
const AREAS = [
  { name: 'Administracion', chiefs: ['contable@bacarsa.com.ar'] },
  { name: 'Comercial', chiefs: ['ivan.barrera@bacarsa.com.ar'] },
  { name: 'Compras', chiefs: ['compras@bacarsa.com.ar'] },
  { name: 'Mantenimiento', chiefs: ['compras@bacarsa.com.ar'] },
  { name: 'Gerencia', chiefs: [
    'ivan.barrera@bacarsa.com.ar',
    'administracion@bacarsa.com.ar',
    'pablo.magnin@bacarsa.com.ar',
    'eduardo.asinardi@bacarsa.com.ar',
    'creartes@bacarsa.com.ar',
  ] },
  { name: 'Guardia', chiefs: ['r.sosa@bacarsa.com.ar'] },
  { name: 'Monitoreo', chiefs: ['r.sosa@bacarsa.com.ar'] },
  { name: 'Operaciones', chiefs: ['l.zemborain@bacarsa.com.ar'] },
  { name: 'RRHH', chiefs: ['jefe.capitalhumano@bacarsa.com.ar'] },
  { name: 'Seguridad Privada', chiefs: ['liliana.zarate@bacarsa.com.ar'] },
  { name: 'Sistemas', chiefs: ['admin@bacarsa.com.ar'] },
  { name: 'Tesoreria', chiefs: ['f.tobares@bacarsa.com.ar'] },
  { name: 'UIF', chiefs: ['cumplimiento@bacarsa.com.ar'] },
  { name: 'Marketing', chiefs: ['alejandro.sanchez@bacarsa.com.ar'] },
]

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

function normEmail(email) {
  return email.trim().toLowerCase()
}

function pickReusableRoot(candidates) {
  const usable = candidates.filter((folder) => !LEGACY_ROOT_IDS.has(folder.id))
  return usable[0] ?? null
}

function rolePatch(currentRole) {
  if (currentRole === 'super_admin' || currentRole === 'admin') return null
  return 'admin'
}

async function main() {
  initAdmin()
  const db = getFirestore()

  console.log(
    dryRun
      ? '=== DRY-RUN: no se escribe folders ni users ==='
      : '=== APPLY: escritura real en folders y users ===',
  )

  const rootsSnap = await db.collection('folders').where('parentFolderId', '==', null).get()
  /** @type {Map<string, {id: string, governingAreaId: unknown}[]>} */
  const rootsByName = new Map()
  for (const docSnap of rootsSnap.docs) {
    const name = String(docSnap.get('name') ?? '')
    const list = rootsByName.get(name) ?? []
    list.push({
      id: docSnap.id,
      governingAreaId: docSnap.get('governingAreaId') ?? null,
    })
    rootsByName.set(name, list)
  }

  const usersSnap = await db.collection('users').get()
  const usersByEmail = new Map()
  for (const docSnap of usersSnap.docs) {
    const email = typeof docSnap.get('email') === 'string' ? normEmail(docSnap.get('email')) : ''
    if (!email) continue
    if (usersByEmail.has(email)) {
      console.log(
        `AVISO: email duplicado en users: ${email} (${usersByEmail.get(email).uid} y ${docSnap.id}). Se usa el primero.`,
      )
      continue
    }
    const managed = Array.isArray(docSnap.get('managedAreaIds'))
      ? docSnap.get('managedAreaIds').filter((id) => typeof id === 'string' && id.length > 0)
      : []
    usersByEmail.set(email, {
      uid: docSnap.id,
      role: docSnap.get('role') ?? null,
      managedAreaIds: managed,
    })
  }

  const areaResults = []
  const assignments = new Map()
  const missingEmails = new Set()

  for (const area of AREAS) {
    const candidates = rootsByName.get(area.name) ?? []
    const existing = pickReusableRoot(candidates)
    const action = existing ? 'REUTILIZA' : 'CREA'
    let areaId = existing?.id ?? null
    let governingNote = ''

    if (existing) {
      if (existing.governingAreaId !== existing.id) {
        governingNote = ` (governingAreaId actual: ${existing.governingAreaId ?? 'ausente'}; no se corrige)`
      }
    } else if (!dryRun) {
      const ref = db.collection('folders').doc()
      areaId = ref.id
      await ref.set({
        name: area.name,
        parentFolderId: null,
        allowedUsers: [],
        governingAreaId: ref.id,
        createdAt: FieldValue.serverTimestamp(),
      })
      const list = rootsByName.get(area.name) ?? []
      list.push({ id: ref.id, governingAreaId: ref.id })
      rootsByName.set(area.name, list)
    }

    areaResults.push({
      name: area.name,
      action,
      areaId,
      governingNote,
    })

    const idForAssign = areaId
    for (const chief of area.chiefs) {
      const email = normEmail(chief)
      const user = usersByEmail.get(email)
      if (!user) {
        missingEmails.add(email)
        continue
      }
      if (!assignments.has(user.uid)) {
        assignments.set(user.uid, {
          email,
          uid: user.uid,
          role: user.role,
          before: [...user.managedAreaIds],
          add: [],
          addNames: [],
        })
      }
      const row = assignments.get(user.uid)
      if (!idForAssign) {
        row.add.push(`${area.name} (id al aplicar)`)
        row.addNames.push(area.name)
        continue
      }
      if (user.managedAreaIds.includes(idForAssign) || row.add.includes(idForAssign)) {
        continue
      }
      row.add.push(idForAssign)
      row.addNames.push(area.name)
    }
  }

  console.log('')
  console.log('=== Áreas ===')
  for (const row of areaResults) {
    const idLabel = row.areaId ?? '(se genera al aplicar)'
    console.log(
      `${row.action.padEnd(9)} "${row.name}"  id=${idLabel}${row.governingNote}`,
    )
  }

  console.log('')
  console.log('=== Jefes ===')
  if (assignments.size === 0) {
    console.log('(ningún usuario encontrado para asignar)')
  }
  for (const row of assignments.values()) {
    const nextRole = rolePatch(row.role)
    const addLabel =
      row.add.length === 0
        ? '(ya tenía todas; sin cambio de áreas)'
        : row.addNames.map((n, i) => `${n} [${row.add[i]}]`).join(', ')
    const roleLabel = nextRole
      ? `role ${row.role ?? '—'} → ${nextRole}`
      : `role ${row.role ?? '—'} (sin cambio)`
    console.log(`${row.email}  uid=${row.uid}  ${roleLabel}  + ${addLabel}`)

    if (dryRun) continue
    const idsToAdd = row.add.filter((id) => typeof id === 'string' && !id.includes('('))
    const patch = {}
    if (idsToAdd.length > 0) {
      patch.managedAreaIds = FieldValue.arrayUnion(...idsToAdd)
    }
    if (nextRole && idsToAdd.length > 0) {
      patch.role = nextRole
    }
    if (Object.keys(patch).length === 0) continue
    await db.collection('users').doc(row.uid).update(patch)
  }

  console.log('')
  console.log('=== Emails sin documento en users ===')
  if (missingEmails.size === 0) {
    console.log('(ninguno)')
  } else {
    for (const email of [...missingEmails].sort()) {
      const areas = AREAS.filter((a) => a.chiefs.some((c) => normEmail(c) === email))
        .map((a) => a.name)
        .join(', ')
      console.log(`${email}  (áreas: ${areas})`)
    }
  }

  console.log('')
  console.log(dryRun ? 'Dry-run listo. Para escribir: npm run areas:seed' : 'Apply listo.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
