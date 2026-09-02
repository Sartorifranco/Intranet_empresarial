const EXTENSION_MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'application/javascript; charset=utf-8',
  mjs: 'application/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  txt: 'text/plain; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  wasm: 'application/wasm',
}

const ALLOWED_DRIVE_MIMES = new Set([
  'text/html',
  'application/javascript',
  'text/javascript',
  'text/css',
  'application/json',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/svg+xml',
  'image/webp',
  'image/x-icon',
  'font/woff',
  'font/woff2',
  'font/ttf',
  'application/wasm',
  'application/octet-stream',
])

export function contentTypeForBoardFile(fileName: string, driveMime: string | null): string | null {
  const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : ''
  if (ext && EXTENSION_MIME[ext]) return EXTENSION_MIME[ext]

  if (driveMime && ALLOWED_DRIVE_MIMES.has(driveMime)) {
    if (driveMime === 'application/octet-stream' && ext === 'js') {
      return 'application/javascript; charset=utf-8'
    }
    if (driveMime.startsWith('text/') && !driveMime.includes('charset')) {
      return `${driveMime}; charset=utf-8`
    }
    return driveMime
  }

  return null
}

export function isAllowedBoardMime(contentType: string | null): boolean {
  if (!contentType) return false
  const base = contentType.split(';')[0]?.trim().toLowerCase()
  return ALLOWED_DRIVE_MIMES.has(base) || base.startsWith('font/')
}

export function boardContentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}
