import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Request, Response } from 'express'
import { getBoardsConfig } from './policy.js'

/**
 * Firebase Hosting reenvía a Cloud Functions solo la cookie `__session`; el resto se
 * elimina en el rewrite. Path acotado a /api/boards para no mezclar con otras rutas.
 */
export const BOARD_SESSION_COOKIE = '__session'
/** 60 min — cubre visualización prolongada; el frontend renueva antes de expirar. */
export const BOARD_SESSION_TTL_SEC = 60 * 60

export interface BoardSessionPayload {
  uid: string
  email: string
  exp: number
}

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url')
}

export function createBoardSessionToken(uid: string, email: string): string {
  const { sessionSecret } = getBoardsConfig()
  if (!sessionSecret) throw new Error('BOARDS_SESSION_SECRET no configurado')

  const payload: BoardSessionPayload = {
    uid,
    email,
    exp: Math.floor(Date.now() / 1000) + BOARD_SESSION_TTL_SEC,
  }
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${payloadB64}.${sign(payloadB64, sessionSecret)}`
}

export function verifyBoardSessionToken(token: string): BoardSessionPayload | null {
  const { sessionSecret } = getBoardsConfig()
  if (!sessionSecret) return null

  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const payloadB64 = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(payloadB64, sessionSecret)
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    ) as BoardSessionPayload
    if (
      typeof payload.uid !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.exp !== 'number'
    ) {
      return null
    }
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=')
    if (rawKey === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return null
}

export function readBoardSession(req: Request): BoardSessionPayload | null {
  const raw = readCookie(req, BOARD_SESSION_COOKIE)
  if (!raw) return null
  return verifyBoardSessionToken(raw)
}

export function setBoardSessionCookie(res: Response, uid: string, email: string): void {
  const token = createBoardSessionToken(uid, email)
  const secure = process.env.FUNCTIONS_EMULATOR !== 'true'
  const parts = [
    `${BOARD_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/api/boards',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${BOARD_SESSION_TTL_SEC}`,
  ]
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}
