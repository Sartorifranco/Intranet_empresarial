import { ExternalLink, Mail } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context'

const GOOGLE_TOKEN_STORAGE_KEY = 'googleToken'
const GMAIL_MESSAGES_BASE_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages'

/** Bandeja principal e importantes; excluye spam, promociones y redes sociales. */
const GMAIL_INBOX_QUERY =
  'is:unread in:inbox -in:spam -category:promotions -category:social (category:primary OR is:important)'

function buildGmailInboxUrl(): string {
  const params = new URLSearchParams({
    q: GMAIL_INBOX_QUERY,
    maxResults: '10',
  })
  return `${GMAIL_MESSAGES_BASE_URL}?${params.toString()}`
}

interface GmailMessageRef {
  id: string
  threadId: string
}

interface GmailMessagesResponse {
  messages?: GmailMessageRef[]
}

interface GmailMessageHeader {
  name: string
  value: string
}

interface GmailMessageDetailResponse {
  id: string
  payload?: {
    headers?: GmailMessageHeader[]
  }
}

export interface GmailEmail {
  id: string
  from: string
  subject: string
}

function getHeaderValue(
  headers: GmailMessageHeader[] | undefined,
  name: string,
): string {
  const header = headers?.find(
    (item) => item.name.toLowerCase() === name.toLowerCase(),
  )
  return header?.value?.trim() ?? ''
}

function parseSender(from: string): string {
  const trimmed = from.trim()
  if (!trimmed) return 'Remitente desconocido'

  const nameWithEmail = trimmed.match(/^("?)(.+?)\1\s*<[^>]+>$/)
  if (nameWithEmail) {
    return nameWithEmail[2].replace(/^"|"$/g, '').trim() || trimmed
  }

  if (trimmed.includes('@')) {
    return trimmed.split('@')[0]
  }

  return trimmed
}

function buildMessageMetadataUrl(messageId: string): string {
  const params = new URLSearchParams({
    format: 'metadata',
  })
  params.append('metadataHeaders', 'From')
  params.append('metadataHeaders', 'Subject')

  return `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?${params.toString()}`
}

async function fetchMessageDetails(
  messages: GmailMessageRef[],
  token: string,
  signal: AbortSignal,
): Promise<GmailEmail[]> {
  const details = await Promise.all(
    messages.map(async (message) => {
      const response = await fetch(buildMessageMetadataUrl(message.id), {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      })

      if (!response.ok) {
        throw new Error(`Gmail message error: ${response.status}`)
      }

      const data = (await response.json()) as GmailMessageDetailResponse
      const fromRaw = getHeaderValue(data.payload?.headers, 'From')
      const subjectRaw = getHeaderValue(data.payload?.headers, 'Subject')

      return {
        id: message.id,
        from: parseSender(fromRaw),
        subject: subjectRaw || '(Sin asunto)',
      }
    }),
  )

  return details
}

export function GmailWidget() {
  const { googleAccessToken, loginWithGoogle } = useAuth()
  const token =
    sessionStorage.getItem(GOOGLE_TOKEN_STORAGE_KEY) ?? googleAccessToken
  const [emails, setEmails] = useState<GmailEmail[]>([])
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setEmails([])
      setError(false)
      return
    }

    setLoading(true)
    const accessToken = token
    const controller = new AbortController()

    async function loadUnreadEmails() {
      try {
        const response = await fetch(buildGmailInboxUrl(), {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Gmail API error: ${response.status}`)
        }

        const data = (await response.json()) as GmailMessagesResponse
        const messages = data.messages ?? []

        if (messages.length === 0) {
          setEmails([])
          setError(false)
          return
        }

        const messageDetails = await fetchMessageDetails(
          messages,
          accessToken,
          controller.signal,
        )

        setEmails(messageDetails)
        setError(false)
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Error al cargar correos de Gmail:', err)
          setError(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadUnreadEmails()

    return () => controller.abort()
  }, [token, googleAccessToken])

  const handleConnectGoogle = async () => {
    setConnecting(true)
    try {
      await loginWithGoogle(true)
    } catch (err) {
      console.error('Error al conectar Google:', err)
    } finally {
      setConnecting(false)
    }
  }

  return (
    <section className="card-minimal overflow-hidden dark:bg-zinc-900">
      <div className="p-4 lg:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-950/40 text-red-400">
            <Mail className="h-5 w-5" />
          </span>
          <p className="text-sm font-semibold text-neutral-900 dark:text-gray-100">Gmail</p>
        </div>

        {!token ? (
          <div className="mb-4">
            <p className="mb-3 text-sm text-neutral-500 dark:text-zinc-400">
              Conectá tu cuenta de Google para ver tus correos sin leer.
            </p>
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={connecting}
              className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:border-red-900/30 hover:bg-neutral-50 hover:text-red-900 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-100 dark:hover:border-red-500/40 dark:hover:bg-zinc-700 dark:hover:text-red-400"
            >
              {connecting ? 'Conectando...' : 'Conectar Google'}
            </button>
          </div>
        ) : loading ? (
          <p className="mb-4 text-sm text-neutral-500 dark:text-zinc-400">
            Cargando bandeja...
          </p>
        ) : error ? (
          <p className="mb-4 text-sm text-neutral-500 dark:text-zinc-400">
            No se pudo cargar tu bandeja de entrada.
          </p>
        ) : emails.length === 0 ? (
          <p className="mb-4 text-sm text-neutral-500 dark:text-zinc-400">
            No tenés correos sin leer en Principal o Importantes.
          </p>
        ) : (
          <ul className="mb-4 space-y-3">
            {emails.map((email) => (
              <li
                key={email.id}
                className="min-w-0 border-b border-neutral-100 pb-3 last:border-b-0 last:pb-0 dark:border-zinc-800"
              >
                <p className="truncate font-semibold text-neutral-900 dark:text-gray-100">
                  {email.from}
                </p>
                <p className="truncate text-sm text-zinc-400">{email.subject}</p>
              </li>
            ))}
          </ul>
        )}

        <a
          href="https://mail.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:border-red-900/30 hover:bg-neutral-50 hover:text-red-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-100 dark:hover:border-red-500/40 dark:hover:bg-zinc-700 dark:hover:text-red-400"
        >
          Abrir Gmail
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </section>
  )
}
