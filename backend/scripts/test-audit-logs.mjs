/**
 * Paso 6: GET /api/audit/logs
 *
 *   node backend/scripts/test-audit-logs.mjs
 */

import { getTestIdToken } from './get-test-token.mjs'

function apiBase() {
  return (
    process.env.FUNCTIONS_API_BASE?.trim() ||
    'http://127.0.0.1:5001/bacar-web/southamerica-east1/api'
  )
}

async function getLogs(idToken, query = '') {
  const res = await fetch(`${apiBase()}/api/audit/logs${query}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  })
  const text = await res.text()
  let body = text
  try {
    body = JSON.parse(text)
  } catch {
    // HTML
  }
  return { status: res.status, body }
}

function printCase(title, result) {
  console.log(`\n=== ${title} ===`)
  console.log(`HTTP ${result.status}`)
  const body = result.body
  if (body && typeof body === 'object' && Array.isArray(body.logs)) {
    console.log(
      JSON.stringify(
        {
          count: body.logs.length,
          nextPageToken: body.nextPageToken,
          sample: body.logs.slice(0, 3).map((l) => ({
            id: l.id,
            action: l.action,
            userEmail: l.userEmail,
            userId: l.userId,
            targetName: l.targetName,
            createdAt: l.createdAt,
          })),
        },
        null,
        2,
      ),
    )
    return
  }
  console.log(typeof body === 'string' ? body : JSON.stringify(body, null, 2))
}

async function main() {
  const admin = await getTestIdToken()
  process.stderr.write(`super_admin uid=${admin.uid} email=${admin.email}\n`)

  const case1 = await getLogs(admin.idToken, '?pageSize=10')
  printCase('1. sin filtro (recientes)', case1)

  const case2 = await getLogs(admin.idToken, '?filterBy=action&value=create&pageSize=10')
  printCase("2. filterBy=action&value=create", case2)

  const case3 = await getLogs(
    admin.idToken,
    `?filterBy=userId&value=${encodeURIComponent(admin.uid)}&pageSize=10`,
  )
  printCase('3. filterBy=userId (cuenta de prueba)', case3)

  let case4
  try {
    const other = await getTestIdToken({ requireSuperAdmin: false })
    process.stderr.write(`no-super uid=${other.uid} email=${other.email} role=${other.role}\n`)
    case4 = await getLogs(other.idToken, '?pageSize=5')
  } catch (err) {
    case4 = {
      status: 0,
      body: { error: err instanceof Error ? err.message : String(err) },
    }
  }
  printCase('4. usuario que no es super_admin (esperado 403)', case4)

  const actionsOk =
    Array.isArray(case2.body?.logs) && case2.body.logs.every((l) => l.action === 'create')
  const usersOk =
    Array.isArray(case3.body?.logs) && case3.body.logs.every((l) => l.userId === admin.uid)

  const ok =
    case1.status === 200 &&
    Array.isArray(case1.body?.logs) &&
    case2.status === 200 &&
    actionsOk &&
    case3.status === 200 &&
    usersOk &&
    case4.status === 403

  process.exit(ok ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
