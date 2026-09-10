import { adminDb } from '../../lib/firebase/admin.js'

export type IntranetContact = {
  name: string
  email: string
  position?: string
  department?: string
}

let contactsCache: { expiresAt: number; rows: IntranetContact[] } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000

function normalizeForMatch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

export async function loadIntranetContacts(): Promise<IntranetContact[]> {
  const now = Date.now()
  if (contactsCache && contactsCache.expiresAt > now) {
    return contactsCache.rows
  }

  const db = adminDb()
  const snap = await db.collection('contacts').orderBy('name', 'asc').get()
  const rows: IntranetContact[] = []
  for (const doc of snap.docs) {
    const data = doc.data()
    const name = typeof data.name === 'string' ? data.name.trim() : ''
    const email =
      typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
    if (!name || !email.includes('@')) continue
    rows.push({
      name,
      email,
      position: typeof data.position === 'string' ? data.position.trim() : undefined,
      department:
        typeof data.department === 'string' ? data.department.trim() : undefined,
    })
  }

  contactsCache = { expiresAt: now + CACHE_TTL_MS, rows }
  return rows
}

export type ContactLookupResult =
  | { status: 'found'; email: string; name: string }
  | { status: 'ambiguous'; matches: IntranetContact[] }
  | { status: 'not_found' }

export function lookupContactEmailByName(
  query: string,
  contacts: IntranetContact[],
): ContactLookupResult {
  const normalizedQuery = normalizeForMatch(query)
  if (!normalizedQuery) return { status: 'not_found' }
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return { status: 'not_found' }

  const matches = contacts.filter((contact) => {
    const normalizedName = normalizeForMatch(contact.name)
    return tokens.every((token) => normalizedName.includes(token))
  })

  if (matches.length === 1) {
    return { status: 'found', email: matches[0]!.email, name: matches[0]!.name }
  }
  if (matches.length > 1) {
    return { status: 'ambiguous', matches }
  }
  return { status: 'not_found' }
}

export function formatContactsDirectoryForPrompt(
  contacts: IntranetContact[],
  maxRows = 120,
): string {
  const slice = contacts.slice(0, maxRows)
  if (slice.length === 0) {
    return 'Directorio de contactos vacío — pedí el email @bacarsa.com.ar si mencionan un nombre.'
  }
  const lines = slice.map(
    (row) => `- ${row.name} → ${row.email}${row.department ? ` (${row.department})` : ''}`,
  )
  const suffix =
    contacts.length > maxRows
      ? `\n… y ${contacts.length - maxRows} contactos más (buscá por nombre completo).`
      : ''
  return (
    'Directorio intranet (nombre → email @bacarsa.com.ar). Usá estos emails en to/cc cuando el usuario diga un nombre:\n' +
    lines.join('\n') +
    suffix
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function looksLikeEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim().toLowerCase())
}
