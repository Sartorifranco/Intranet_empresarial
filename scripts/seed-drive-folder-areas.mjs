/**
 * Escribe driveFolderAreas/{driveTopLevelFolderId} → governingAreaId.
 * Pares confirmados a mano (UIF usa el stub nuevo, no el id viejo).
 *
 *   npm run drive-areas:seed:dry-run
 *   npm run drive-areas:seed
 */

import { initializeApp, applicationDefault, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dryRun = !process.argv.includes('--apply')
const COLLECTION = 'driveFolderAreas'

/** driveTopLevelFolderId → governingAreaId (folders raíz nuevas) */
const PAIRS = [
  { name: 'Administracion', driveId: '1Oz7iuBvjoOMsEArHAhADeNK7CMGNemhY', governingAreaId: 'GgnU5ZugU1FO0wlOaXUV' },
  { name: 'Comercial', driveId: '1-TSL3f20lI5HlqmgN_LVGVYYwznhlUyd', governingAreaId: 'ilPM8NPCRq5yuK8YLKqh' },
  { name: 'Compras', driveId: '1dzq22AX5t9SM72plMcXvhgrYKOzAoq1z', governingAreaId: 'jSjSQyovcecqu9VmlvCd' },
  { name: 'Gerencia', driveId: '1DimigcRCk_qMVO5zbWGN5V0cz6dWSBrU', governingAreaId: 'MM25DIlzctON9kegb4MF' },
  { name: 'Tableros Gerencia', driveId: '1RpkClQ5CduQeGdwgFR0PxW9lPz2mbZ40', governingAreaId: 'MM25DIlzctON9kegb4MF' },
  { name: 'Guardia', driveId: '1RPrzCvf1JEHEtVSK5F7ZcZbDByrFI60Y', governingAreaId: 'UZI1nC04of2IaBnsac69' },
  { name: 'Mantenimiento', driveId: '1-66uogZax3S8ZgtDVasqZkn9_PwFo6UI', governingAreaId: '33JjvSPqCx7gJLS3tQTe' },
  { name: 'Marketing', driveId: '16rAF6Fl95YUa8YDhCIk-zQjvu_kz_U4j', governingAreaId: 'ExLUAaL801r6h5RuRqAK' },
  { name: 'Monitoreo', driveId: '19vzvby3dd8QOZ8dZfLfmGqzSCubDzDSy', governingAreaId: 'WrZbkgWFDw8wt08KOZrt' },
  { name: 'Operaciones', driveId: '1NeotsCiPgZaaL1NNTbjHGilltY-IIwq7', governingAreaId: 'a36R9jwN4m47Ftn3wGCp' },
  { name: 'RRHH', driveId: '1mI2NTTlhnwT4cm34QkaApGgNSsJOhWjp', governingAreaId: 'h22XJ3GkuK6nkddQdLvn' },
  { name: 'Seguridad Privada', driveId: '1-wRlmFjn-geLasdZDZS5gR-wW39N8d9M', governingAreaId: 'RiT9rO8z0cvSEBU6CR3v' },
  { name: 'Sistemas', driveId: '188-zgNhMIfeUjAI8GracINlItBbFwoUb', governingAreaId: 'r7QVKsrSiqDWC8DrXCac' },
  { name: 'Tesoreria', driveId: '1vQN2S2Au3rab0eTFXVVnqXn7KJaO8sod', governingAreaId: 'hgMRKqW1vaLElwr9O7Wi' },
  { name: 'UIF', driveId: '1-wPj5kXNCUlP00iZtKO7IbakA1P3uIOo', governingAreaId: 'OWWnpfsRRx0XQ6FCqlOa' },
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

async function main() {
  initAdmin()
  const db = getFirestore()

  console.log(
    dryRun
      ? `=== DRY-RUN: no se escribe ${COLLECTION} ===`
      : `=== APPLY: upsert en ${COLLECTION} ===`,
  )

  for (const pair of PAIRS) {
    console.log(
      `${pair.name}  Drive [${pair.driveId}]  →  governingAreaId ${pair.governingAreaId}`,
    )
    if (dryRun) continue
    await db.collection(COLLECTION).doc(pair.driveId).set({
      governingAreaId: pair.governingAreaId,
      name: pair.name,
      updatedAt: FieldValue.serverTimestamp(),
    })
  }

  console.log('')
  console.log(dryRun ? 'Dry-run listo. Para escribir: npm run drive-areas:seed' : `Listo. Documentos: ${PAIRS.length}.`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
