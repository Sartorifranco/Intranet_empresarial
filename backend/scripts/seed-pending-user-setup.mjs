/**
 * Carga pendingUserSetup/{email} para jefes de área que aún no iniciaron sesión.
 *
 *   npm run pending:seed:dry-run
 *   npm run pending:seed
 */

import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb, initAdmin, loadTestEnv } from './get-test-token.mjs'

const dryRun = !process.argv.includes('--apply')
const PENDING_COLLECTION = 'pendingUserSetup'

const DEFAULT_PERMISSIONS = {
  view_directory: true,
  view_drive: true,
}

const GERENCIA_BOARDS = [
  {
    boardFolderId: '140_xtWc8wk4hl7Tfy9aU-VRm41AGjzv9',
    boardName: 'compras',
  },
  {
    boardFolderId: '1YdnvQKexWl32K1QlcHui6JYDCAshxEGk',
    boardName: 'facturas-electronicas',
  },
  {
    boardFolderId: '1i9JpVjspo9IXxksKL1DursnqbjX5b-Xp',
    boardName: 'novedades-camioneros',
  },
]

const GERENCIA_BOARD_EMAILS = new Set([
  'ivan.barrera@bacarsa.com.ar',
  'administracion@bacarsa.com.ar',
  'pablo.magnin@bacarsa.com.ar',
  'eduardo.asinardi@bacarsa.com.ar',
  'creartes@bacarsa.com.ar',
])

/** Email → managedAreaIds (role admin para todos). */
const PENDING_CHIEFS = [
  {
    email: 'contable@bacarsa.com.ar',
    managedAreaIds: ['GgnU5ZugU1FO0wlOaXUV'],
    areaLabels: ['Administracion'],
  },
  {
    email: 'ivan.barrera@bacarsa.com.ar',
    managedAreaIds: ['ilPM8NPCRq5yuK8YLKqh', 'MM25DIlzctON9kegb4MF'],
    areaLabels: ['Comercial', 'Gerencia'],
  },
  {
    email: 'compras@bacarsa.com.ar',
    managedAreaIds: ['jSjSQyovcecqu9VmlvCd', '33JjvSPqCx7gJLS3tQTe'],
    areaLabels: ['Compras', 'Mantenimiento'],
  },
  {
    email: 'administracion@bacarsa.com.ar',
    managedAreaIds: ['MM25DIlzctON9kegb4MF'],
    areaLabels: ['Gerencia'],
  },
  {
    email: 'pablo.magnin@bacarsa.com.ar',
    managedAreaIds: ['MM25DIlzctON9kegb4MF'],
    areaLabels: ['Gerencia'],
  },
  {
    email: 'eduardo.asinardi@bacarsa.com.ar',
    managedAreaIds: ['MM25DIlzctON9kegb4MF'],
    areaLabels: ['Gerencia'],
  },
  {
    email: 'creartes@bacarsa.com.ar',
    managedAreaIds: ['MM25DIlzctON9kegb4MF'],
    areaLabels: ['Gerencia'],
  },
  {
    email: 'r.sosa@bacarsa.com.ar',
    managedAreaIds: ['UZI1nC04of2IaBnsac69', 'WrZbkgWFDw8wt08KOZrt'],
    areaLabels: ['Guardia', 'Monitoreo'],
  },
  {
    email: 'l.zemborain@bacarsa.com.ar',
    managedAreaIds: ['a36R9jwN4m47Ftn3wGCp'],
    areaLabels: ['Operaciones'],
  },
  {
    email: 'jefe.capitalhumano@bacarsa.com.ar',
    managedAreaIds: ['h22XJ3GkuK6nkddQdLvn'],
    areaLabels: ['RRHH'],
  },
  {
    email: 'liliana.zarate@bacarsa.com.ar',
    managedAreaIds: ['RiT9rO8z0cvSEBU6CR3v'],
    areaLabels: ['Seguridad Privada'],
  },
  {
    email: 'f.tobares@bacarsa.com.ar',
    managedAreaIds: ['hgMRKqW1vaLElwr9O7Wi'],
    areaLabels: ['Tesoreria'],
  },
  {
    email: 'cumplimiento@bacarsa.com.ar',
    managedAreaIds: ['OWWnpfsRRx0XQ6FCqlOa'],
    areaLabels: ['UIF'],
  },
  {
    email: 'alejandro.sanchez@bacarsa.com.ar',
    managedAreaIds: ['ExLUAaL801r6h5RuRqAK'],
    areaLabels: ['Marketing'],
  },
]

function buildPendingDoc(row) {
  const email = row.email.trim().toLowerCase()
  const boardAccess = GERENCIA_BOARD_EMAILS.has(email) ? GERENCIA_BOARDS : []
  return {
    email,
    role: 'admin',
    managedAreaIds: row.managedAreaIds,
    memberAreaIds: [],
    permissions: { ...DEFAULT_PERMISSIONS },
    boardAccess,
    note: 'Seed jefes de área — pendingUserSetup',
    applied: false,
  }
}

async function findExistingUserByEmail(db, email) {
  const snap = await db.collection('users').where('email', '==', email).limit(1).get()
  return snap.empty ? null : snap.docs[0]
}

async function main() {
  loadTestEnv()
  initAdmin()
  const db = getAdminDb()

  console.log(dryRun ? '=== DRY-RUN (sin escrituras) ===' : '=== APPLY ===')
  console.log(`Registros a procesar: ${PENDING_CHIEFS.length}\n`)

  let wouldWrite = 0
  let skippedApplied = 0
  let skippedExistingUser = 0
  let updated = 0
  let created = 0

  for (const row of PENDING_CHIEFS) {
    const email = row.email.trim().toLowerCase()
    const pendingRef = db.collection(PENDING_COLLECTION).doc(email)
    const pendingSnap = await pendingRef.get()
    const existingUser = await findExistingUserByEmail(db, email)
    const doc = buildPendingDoc(row)

    console.log(`--- ${email} ---`)
    console.log(`  Rol: admin`)
    console.log(`  Áreas: ${row.areaLabels.join(', ')} (${doc.managedAreaIds.join(', ')})`)
    console.log(
      `  Permisos: view_directory=${doc.permissions.view_directory}, view_drive=${doc.permissions.view_drive}`,
    )
    if (doc.boardAccess.length > 0) {
      console.log(
        `  Tableros: ${doc.boardAccess.map((b) => b.boardName).join(', ')}`,
      )
    } else {
      console.log('  Tableros: (ninguno)')
    }

    if (existingUser) {
      skippedExistingUser += 1
      console.log(
        `  ⚠ SKIP: ya existe users/${existingUser.id} — el pending no aplica al primer login (ya pasó)`,
      )
      console.log('')
      continue
    }

    if (pendingSnap.exists && pendingSnap.get('applied') === true) {
      skippedApplied += 1
      console.log(
        `  ⚠ SKIP: pendingUserSetup/${email} ya aplicado (appliedToUid=${pendingSnap.get('appliedToUid') ?? '?'})`,
      )
      console.log('')
      continue
    }

    if (pendingSnap.exists) {
      console.log('  Acción: actualizar documento pending existente (aún no aplicado)')
      updated += 1
    } else {
      console.log('  Acción: crear pendingUserSetup/' + email)
      created += 1
    }

    wouldWrite += 1

    if (!dryRun) {
      const payload = {
        ...doc,
        createdAt: pendingSnap.exists
          ? pendingSnap.get('createdAt') ?? FieldValue.serverTimestamp()
          : FieldValue.serverTimestamp(),
        createdByUid: pendingSnap.exists
          ? pendingSnap.get('createdByUid') ?? 'seed-pending-user-setup'
          : 'seed-pending-user-setup',
        createdByEmail: pendingSnap.exists
          ? pendingSnap.get('createdByEmail') ?? 'seed@intranet'
          : 'seed@intranet',
        updatedAt: FieldValue.serverTimestamp(),
      }
      await pendingRef.set(payload, { merge: true })
      console.log('  ✓ Escrito')
    }

    console.log('')
  }

  console.log('--- Resumen ---')
  console.log(`Crear: ${created}`)
  console.log(`Actualizar: ${updated}`)
  console.log(`Escribirían/aplicados: ${wouldWrite}`)
  console.log(`Omitidos (usuario ya existe): ${skippedExistingUser}`)
  console.log(`Omitidos (pending ya aplicado): ${skippedApplied}`)

  if (dryRun) {
    console.log('\nPara aplicar: npm run pending:seed')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
