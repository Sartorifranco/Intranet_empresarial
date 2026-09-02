/**
 * Prueba listado + sesión + proxy de tableros.
 *
 * Requiere en backend/.env:
 *   BOARDS_CONTAINER_FOLDER_ID, BOARDS_SESSION_SECRET
 *
 *   npm run test:boards
 */

import { getTestIdToken } from './get-test-token.mjs'

function apiBase() {
  return (
    process.env.FUNCTIONS_API_BASE?.trim() ||
    'http://127.0.0.1:5001/bacar-web/southamerica-east1/api'
  )
}

async function main() {
  const user = await getTestIdToken()
  const base = apiBase()

  const sessionRes = await fetch(`${base}/api/boards/session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.idToken}` },
  })
  const setCookies = sessionRes.headers.getSetCookie?.() ?? []
  const setCookie = setCookies[0] ?? sessionRes.headers.get('set-cookie')
  console.log('session', sessionRes.status, setCookie ? 'Set-Cookie ok' : 'sin cookie')
  if (setCookie) console.log('cookie name', setCookie.split('=')[0])

  const listRes = await fetch(`${base}/api/boards`, {
    headers: { Authorization: `Bearer ${user.idToken}` },
  })
  const listBody = await listRes.json().catch(() => ({}))
  console.log('list', listRes.status, JSON.stringify(listBody))

  const board = listBody.boards?.[0]
  if (!board?.id || !setCookie) {
    console.log('SKIP asset (sin tableros o sin cookie)')
    process.exit(listRes.status === 200 ? 0 : 1)
  }

  const cookie = setCookie.split(';')[0]
  const htmlRes = await fetch(`${base}/api/boards/${board.id}/index.html`, {
    headers: { Cookie: cookie },
  })
  const htmlSnippet = (await htmlRes.text()).slice(0, 120)
  console.log('html', htmlRes.status, htmlSnippet.replace(/\s+/g, ' '))

  const checks = [
    ['session 200', sessionRes.status === 200],
    ['list 200', listRes.status === 200],
    ['html 200', htmlRes.status === 200],
    ['html contiene <html', htmlSnippet.toLowerCase().includes('<html')],
  ]
  for (const [label, ok] of checks) console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}`)
  process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
