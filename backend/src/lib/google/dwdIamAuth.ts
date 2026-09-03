import { google } from 'googleapis'
import { logError } from '../log.js'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const IAM_SCOPE = 'https://www.googleapis.com/auth/cloud-platform'

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>

async function getAdcAccessToken(): Promise<string> {
  const googleAuth = new google.auth.GoogleAuth({ scopes: [IAM_SCOPE] })
  const client = await googleAuth.getClient()
  const { token } = await client.getAccessToken()
  if (!token) {
    throw new Error('ADC no devolvió access token para IAM Credentials API')
  }
  return token
}

export async function exchangeDwdAccessToken(
  serviceAccountEmail: string,
  subject: string,
  scopes: readonly string[],
): Promise<{ access_token: string; expiry_date: number }> {
  const adcToken = await getAdcAccessToken()
  const now = Math.floor(Date.now() / 1000)
  const payload = JSON.stringify({
    iss: serviceAccountEmail,
    sub: subject,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
    scope: scopes.join(' '),
  })

  const signUrl = `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(serviceAccountEmail)}:signJwt`

  let signedJwt: string | undefined
  try {
    const signRes = await fetch(signUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adcToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ payload }),
    })
    const signBody = (await signRes.json().catch(() => ({}))) as {
      signedJwt?: string
      error?: { message?: string }
    }
    if (!signRes.ok) {
      throw new Error(signBody.error?.message ?? `signJwt HTTP ${signRes.status}`)
    }
    signedJwt = signBody.signedJwt
  } catch (err) {
    logError('IAM Credentials signJwt falló', err)
    throw new Error('No se pudo firmar el JWT de delegación vía IAM Credentials API')
  }

  if (!signedJwt) {
    throw new Error('IAM signJwt no devolvió signedJwt')
  }

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: signedJwt,
    }),
  })

  const tokenBody = (await tokenRes.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    error?: string
    error_description?: string
  }

  if (!tokenRes.ok || !tokenBody.access_token) {
    const detail = tokenBody.error_description ?? tokenBody.error ?? `HTTP ${tokenRes.status}`
    logError('Intercambio OAuth JWT-bearer falló', new Error(detail))
    throw new Error('No se pudo obtener access token de Drive vía JWT firmado por IAM')
  }

  return {
    access_token: tokenBody.access_token,
    expiry_date: Date.now() + (tokenBody.expires_in ?? 3600) * 1000,
  }
}

/** OAuth2 con refresh vía IAM signJwt + grant jwt-bearer (prod, sin JSON). */
export function createDwdOAuth2Client(
  serviceAccountEmail: string,
  subject: string,
  scopes: readonly string[],
): OAuth2Client {
  const client = new google.auth.OAuth2()
  client.credentials = { expiry_date: 1 }

  client.refreshAccessToken = async () => {
    const { access_token, expiry_date } = await exchangeDwdAccessToken(
      serviceAccountEmail,
      subject,
      scopes,
    )
    const credentials = {
      access_token,
      expiry_date,
      token_type: 'Bearer',
    }
    client.setCredentials(credentials)
    return { credentials, res: null }
  }

  return client
}
