const DRIVE_ID_RE = /^[a-zA-Z0-9_-]+$/

/** IDs de Drive: letras, números, _ y - (evita inyectar comillas en q). */
export function sanitizeDriveId(raw: string): string | null {
  const id = raw.trim()
  if (!id) return null
  if (!DRIVE_ID_RE.test(id)) return null
  return id
}
