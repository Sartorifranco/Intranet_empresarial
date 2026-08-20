/**
 * Prueba local de reglas users (get propio / list restringido).
 * Requiere emulador Firestore en :8080.
 *
 * Uso: node scripts/test-users-rules.mjs
 */
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import { readFileSync } from 'node:fs'
import { doc, getDoc, getDocs, collection, setDoc } from 'firebase/firestore'

const PROJECT_ID = 'bacar-web-rules-test'
const RULES = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8')

async function seed(env) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'users', 'user-common'), {
      email: 'comun@bacarsa.com.ar',
      displayName: 'Usuario Comun',
      role: 'user',
      permissions: { super_admin: false, manage_users: false },
    })
    await setDoc(doc(db, 'users', 'user-other'), {
      email: 'otro@bacarsa.com.ar',
      displayName: 'Otro',
      role: 'user',
      permissions: { super_admin: false, manage_users: false },
    })
    await setDoc(doc(db, 'users', 'user-super'), {
      email: 'admin@bacarsa.com.ar',
      displayName: 'Super Admin',
      role: 'super_admin',
      permissions: {
        super_admin: true,
        manage_users: true,
        manage_news: true,
        manage_links: true,
        view_directory: true,
        view_drive: true,
        view_links: true,
      },
    })
  })
}

function result(label, ok, detail = '') {
  const status = ok ? 'PASS' : 'FAIL'
  console.log(`[${status}] ${label}${detail ? ` — ${detail}` : ''}`)
  return ok
}

async function main() {
  const env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: RULES,
      host: '127.0.0.1',
      port: 8080,
    },
  })

  await env.clearFirestore()
  await seed(env)

  let allOk = true

  // 1) Usuario común lee su propio documento → OK
  try {
    const common = env.authenticatedContext('user-common', {
      email: 'comun@bacarsa.com.ar',
    })
    await assertSucceeds(getDoc(doc(common.firestore(), 'users', 'user-common')))
    allOk = result('Usuario común GET propio doc', true) && allOk
  } catch (err) {
    allOk = result('Usuario común GET propio doc', false, String(err)) && allOk
  }

  // 2) Usuario común lista toda la colección → permission-denied
  try {
    const common = env.authenticatedContext('user-common', {
      email: 'comun@bacarsa.com.ar',
    })
    await assertFails(getDocs(collection(common.firestore(), 'users')))
    allOk = result('Usuario común LIST users', true, 'permission-denied esperado') && allOk
  } catch (err) {
    allOk = result('Usuario común LIST users', false, String(err)) && allOk
  }

  // 3) Super Admin lista toda la colección → OK
  try {
    const superAdmin = env.authenticatedContext('user-super', {
      email: 'admin@bacarsa.com.ar',
    })
    await assertSucceeds(getDocs(collection(superAdmin.firestore(), 'users')))
    allOk = result('Super Admin LIST users', true) && allOk
  } catch (err) {
    allOk = result('Super Admin LIST users', false, String(err)) && allOk
  }

  await env.cleanup()
  if (!allOk) {
    process.exitCode = 1
  }
}

main().catch((err) => {
  console.error('Test de reglas falló:', err)
  process.exitCode = 1
})
