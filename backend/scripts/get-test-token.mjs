/**
 * ID token de un super_admin real (custom token → Identity Toolkit).
 *
 * Uso:
 *   node backend/scripts/get-test-token.mjs
 *   node backend/scripts/get-test-token.mjs --json
 *
 * Opcional: TEST_UID o TEST_EMAIL.
 * Credenciales: ADMIN_SDK_KEY_PATH (backend/.env.local) + VITE_FIREBASE_API_KEY (.env.local).
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const IDENTITY_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken'

function loadEnvFile(envPath) {
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
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export function loadTestEnv() {
  loadEnvFile(resolve(ROOT, 'backend/.env'))
  loadEnvFile(resolve(ROOT, 'backend/.env.local'))
  loadEnvFile(resolve(ROOT, '.env.local'))
  loadEnvFile(resolve(ROOT, '.env'))
}

export function getAdminDb() {
  initAdmin()
  return getFirestore()
}

export function initAdmin() {
  if (getApps().length > 0) return

  loadTestEnv()
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

async function resolveTestUser(db) {
  const testUid = process.env.TEST_UID?.trim()
  if (testUid) {
    const snap = await db.collection('users').doc(testUid).get()
    if (!snap.exists) {
      throw new Error(`No hay users/${testUid}`)
    }
    return { uid: snap.id, data: snap.data() ?? {} }
  }

  const testEmail = process.env.TEST_EMAIL?.trim().toLowerCase()
  if (testEmail) {
    const q = await db.collection('users').where('email', '==', testEmail).limit(1).get()
    if (q.empty) {
      throw new Error(`No hay users con email ${testEmail}`)
    }
    return { uid: q.docs[0].id, data: q.docs[0].data() ?? {} }
  }

  const q = await db.collection('users').where('role', '==', 'super_admin').limit(5).get()
  if (q.empty) {
    throw new Error("No hay users con role 'super_admin' (definí TEST_UID o TEST_EMAIL)")
  }
  return { uid: q.docs[0].id, data: q.docs[0].data() ?? {} }
}

export async function getTestIdToken(options = { requireSuperAdmin: true }) {
  initAdmin()
  loadTestEnv()

  const apiKey = process.env.VITE_FIREBASE_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('Falta VITE_FIREBASE_API_KEY en .env.local')
  }

  const db = getFirestore()
  const auth = getAuth()
  let uid
  let data
  if (options.requireSuperAdmin === false) {
    const picked = await resolveNonSuperAdminUser(db, auth)
    uid = picked.uid
    data = picked.data
  } else {
    const resolved = await resolveTestUser(db)
    uid = resolved.uid
    data = resolved.data
    const role = data.role
    if (role !== 'super_admin') {
      throw new Error(`users/${uid} no es super_admin (role=${String(role)})`)
    }
  }

  let record
  try {
    record = await auth.getUser(uid)
  } catch {
    throw new Error(`El uid ${uid} existe en Firestore pero no en Firebase Auth`)
  }

  const email = (record.email ?? data.email ?? '').trim().toLowerCase()
  if (!email) {
    throw new Error(`users/${uid} no tiene email`)
  }

  if (!record.emailVerified) {
    await auth.updateUser(uid, { emailVerified: true })
  }

  const customToken = await auth.createCustomToken(uid)
  const res = await fetch(`${IDENTITY_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  })
  const payload = await res.json()
  if (!res.ok || typeof payload.idToken !== 'string') {
    const msg = payload.error?.message ?? JSON.stringify(payload)
    throw new Error(`Identity Toolkit rechazó el custom token: ${msg}`)
  }

  return { uid, email, idToken: payload.idToken, role: data.role ?? null }
}

async function resolveNonSuperAdminUser(db, auth) {
  const testEmail = process.env.TEST_EMAIL?.trim().toLowerCase()
  if (testEmail) {
    let docSnap = null
    const q = await db.collection('users').where('email', '==', testEmail).limit(1).get()
    if (!q.empty) {
      docSnap = q.docs[0]
    } else {
      const all = await db.collection('users').get()
      docSnap =
        all.docs.find((doc) => {
          const email =
            typeof doc.get('email') === 'string' ? doc.get('email').trim().toLowerCase() : ''
          return email === testEmail
        }) ?? null
    }
    if (!docSnap) {
      throw new Error(`No hay users con email ${testEmail}`)
    }
    const data = docSnap.data() ?? {}
    if (data.role === 'super_admin') {
      throw new Error(`${testEmail} es super_admin; para Frente 1 usá un usuario normal`)
    }
    try {
      await auth.getUser(docSnap.id)
    } catch {
      throw new Error(`${testEmail} existe en Firestore pero no en Firebase Auth`)
    }
    return { uid: docSnap.id, data }
  }

  const snaps = await db.collection('users').limit(80).get()
  for (const doc of snaps.docs) {
    const data = doc.data() ?? {}
    if (data.role === 'super_admin') continue
    try {
      await auth.getUser(doc.id)
      return { uid: doc.id, data }
    } catch {
      // sin cuenta Auth
    }
  }
  throw new Error('No hay un users/{uid} con Auth que no sea super_admin')
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isMain) {
  getTestIdToken()
    .then((out) => {
      if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(out)}\n`)
        return
      }
      process.stderr.write(`Token listo uid=${out.uid} email=${out.email}\n`)
      process.stdout.write(`${out.idToken}\n`)
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
