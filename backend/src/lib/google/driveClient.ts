import { google, type drive_v3 } from 'googleapis'
import { DRIVE_SCOPES, getEnv, isEmailInAllowedDomain } from '../../config/env.js'
import { logError } from '../log.js'
import { createDwdOAuth2Client } from './dwdIamAuth.js'

const CLIENT_TTL_MS = 50 * 60 * 1000
const MAX_CACHED_CLIENTS = 100

type DriveAuthClient = InstanceType<typeof google.auth.JWT> | InstanceType<typeof google.auth.OAuth2>

type CachedDriveAuth = {
  auth: DriveAuthClient
  expiresAt: number
}

const authCache = new Map<string, CachedDriveAuth>()
const authInFlight = new Map<string, Promise<DriveAuthClient>>()

async function resolveRuntimeServiceAccountEmail(): Promise<string> {
  const fromEnv = getEnv().driveServiceAccountEmail
  if (fromEnv) return fromEnv

  const metadataUrl =
    'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email'

  try {
    const res = await fetch(metadataUrl, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000),
    })
    if (!res.ok) {
      throw new Error(`metadata ${res.status}`)
    }
    const email = (await res.text()).trim()
    if (!email.includes('@')) {
      throw new Error('metadata email vacío')
    }
    return email
  } catch (err) {
    logError('No se pudo resolver el email de la SA vía metadata', err)
    throw new Error(
      'No hay cuenta de servicio para Drive. En local definí DRIVE_SERVICE_ACCOUNT_KEY_PATH. ' +
        'En Cloud Functions adjuntá la SA con Domain-Wide Delegation, o definí DRIVE_SERVICE_ACCOUNT_EMAIL.',
    )
  }
}

/**
 * Cliente JWT con DWD. Sin subject usa datos@… (operaciones de gobernanza).
 * Listar/crear/enviar a papelera pasan el subject vía resolveDriveSubject(user):
 * super_admin → DRIVE_IMPERSONATE_EMAIL; demás roles → email del usuario.
 * - Local: JSON en DRIVE_SERVICE_ACCOUNT_KEY_PATH (datos-drive-sa). Nunca GOOGLE_APPLICATION_CREDENTIALS.
 * - Prod: IAM Credentials signJwt (ADC) → oauth2 token exchange → access token Drive.
 */
export async function getDriveAuth(subject?: string): Promise<DriveAuthClient> {
  const env = getEnv()
  const normalizedSubject = (subject ?? env.driveImpersonateEmail).trim().toLowerCase()
  if (!isEmailInAllowedDomain(normalizedSubject, env.allowedEmailDomain)) {
    throw new Error(`No se puede impersonar un email fuera de @${env.allowedEmailDomain}`)
  }

  const now = Date.now()
  for (const [email, cached] of authCache) {
    if (cached.expiresAt <= now) authCache.delete(email)
  }

  const cached = authCache.get(normalizedSubject)
  if (cached && cached.expiresAt > now) return cached.auth

  const pending = authInFlight.get(normalizedSubject)
  if (pending) return pending

  const authorize = (async () => {
    let auth: DriveAuthClient
    let tokenExpiry: number

    if (env.driveServiceAccountKeyPath) {
      const jwt = new google.auth.JWT({
        keyFile: env.driveServiceAccountKeyPath,
        scopes: [...DRIVE_SCOPES],
        subject: normalizedSubject,
      })
      const credentials = await jwt.authorize()
      auth = jwt
      tokenExpiry =
        typeof credentials.expiry_date === 'number'
          ? credentials.expiry_date - 60_000
          : now + CLIENT_TTL_MS
    } else {
      const saEmail = await resolveRuntimeServiceAccountEmail()
      auth = createDwdOAuth2Client(saEmail, normalizedSubject, DRIVE_SCOPES)
      const { credentials } = await auth.refreshAccessToken()
      tokenExpiry =
        typeof credentials.expiry_date === 'number'
          ? credentials.expiry_date - 60_000
          : now + CLIENT_TTL_MS
    }

    const expiresAt = Math.min(now + CLIENT_TTL_MS, tokenExpiry)

    if (authCache.size >= MAX_CACHED_CLIENTS) {
      const oldest = authCache.keys().next().value
      if (oldest) authCache.delete(oldest)
    }
    authCache.set(normalizedSubject, { auth, expiresAt })
    return auth
  })()

  authInFlight.set(normalizedSubject, authorize)
  try {
    return await authorize
  } finally {
    authInFlight.delete(normalizedSubject)
  }
}

export async function getDrive(subject?: string): Promise<drive_v3.Drive> {
  const auth = await getDriveAuth(subject)
  return google.drive({ version: 'v3', auth })
}
