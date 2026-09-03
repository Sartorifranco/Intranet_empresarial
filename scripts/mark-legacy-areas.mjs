/**
 * Marca áreas raíz legacy con `legacy: true` (no se borran; quedan fuera de selectores).
 *
 *   npm run areas:mark-legacy:dry-run
 *   npm run areas:mark-legacy
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apply = process.argv.includes('--apply')

/** Raíces del sistema anterior (jun–ago 2025). Ver scripts/backups/legacy-folders-audit.json */
export const LEGACY_ROOT_AREA_IDS = [
  'SNo0SnbELRHX4HBjrxoo', // Adm Seguridad Privada
  'n6UcEFiJCSPQZnQESape', // Administracion de Personal
  'E0b7GPU8UjCY8vkgggN7', // Caminos de las sierras
  'jEQYpeJW2tlDUdSuQcPx', // Manuales (Procedimientos)
  'FLuH9quepVppeJqG4DaG', // Monitoreo - Guardia
  '6vPWuL3OgDznbWoPuacd', // Orden de compra
  'KcPOCBUsTp2ia2C18ppK', // Visitas
  'mnCpjJYbw761Mae06MQs', // Sistemas (vieja)
  'yKI3EZmt80MfTyfAdIz5', // UIF (vieja)
]

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

async function main() {
  initAdmin()
  const db = getFirestore()

  console.log(apply ? '=== APPLY: legacy: true ===' : '=== DRY-RUN ===')

  for (const id of LEGACY_ROOT_AREA_IDS) {
    const ref = db.collection('folders').doc(id)
    const snap = await ref.get()
    if (!snap.exists) {
      console.log(`SKIP  ${id}  (no existe)`)
      continue
    }
    const name = typeof snap.get('name') === 'string' ? snap.get('name') : id
    const already = snap.get('legacy') === true
    if (already) {
      console.log(`OK    ${id}  "${name}"  (ya legacy)`)
      continue
    }
    console.log(`${apply ? 'MARK' : 'WOULD'} ${id}  "${name}"`)
    if (apply) {
      await ref.set({ legacy: true }, { merge: true })
    }
  }

  console.log(apply ? '\nListo.' : '\nEjecutá con --apply para escribir.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
