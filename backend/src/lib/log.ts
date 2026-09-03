const REDACT_KEYS = /private_key|client_secret|refresh_token|access_token|id_token|authorization|bearer |credentials|gtoken|jwt/i

export function logInfo(message: string, extra?: Record<string, unknown>): void {
  if (!extra) {
    console.info(message)
    return
  }
  console.info(message, sanitize(extra))
}

export function logError(message: string, err: unknown): void {
  const e = err as {
    message?: string
    code?: string
    status?: number
    name?: string
  }
  console.error(message, {
    name: e?.name,
    code: e?.code,
    status: e?.status,
    message: redactText(e?.message ?? String(err)),
  })
}

function sanitize(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === 'string') return redactText(value)
  if (Array.isArray(value)) return value.map(sanitize)
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEYS.test(k) ? '[redacted]' : sanitize(v)
    }
    return out
  }
  return value
}

function redactText(text: string): string {
  return text
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----/g, '[redacted-key]')
    .replace(/ya29\.[a-zA-Z0-9._-]+/g, '[redacted-token]')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted-jwt]')
}
