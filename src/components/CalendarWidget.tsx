import { Calendar, ExternalLink } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../context'

const GOOGLE_TOKEN_STORAGE_KEY = 'googleToken'
const CALENDAR_EVENTS_BASE_URL =
  'https://www.googleapis.com/calendar/v3/calendars/primary/events'

interface CalendarEventItem {
  summary?: string
  start?: {
    dateTime?: string
    date?: string
  }
}

interface CalendarEventsResponse {
  items?: CalendarEventItem[]
}

export interface TodayCalendarEvent {
  summary: string
  startTime: string
}

function getTodayBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)

  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  }
}

function formatEventStartTime(start?: CalendarEventItem['start']): string {
  if (start?.dateTime) {
    return new Date(start.dateTime).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  }

  if (start?.date) {
    return 'Todo el día'
  }

  return '--:--'
}

function mapCalendarEvents(items: CalendarEventItem[]): TodayCalendarEvent[] {
  return items.slice(0, 4).map((item) => ({
    summary: item.summary?.trim() || 'Sin título',
    startTime: formatEventStartTime(item.start),
  }))
}

function buildCalendarEventsUrl() {
  const { timeMin, timeMax } = getTodayBounds()

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '4',
  })

  return `${CALENDAR_EVENTS_BASE_URL}?${params.toString()}`
}

function CalendarWidgetSkeleton() {
  return (
    <section className="card-minimal overflow-hidden dark:bg-zinc-900">
      <div className="animate-pulse p-4 lg:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
          <div className="h-4 w-32 rounded bg-neutral-100 dark:bg-zinc-800" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-10 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    </section>
  )
}

export function CalendarWidget() {
  const { googleAccessToken, loginWithGoogle } = useAuth()
  const token =
    sessionStorage.getItem(GOOGLE_TOKEN_STORAGE_KEY) ?? googleAccessToken
  const [events, setEvents] = useState<TodayCalendarEvent[]>([])
  const [loading, setLoading] = useState(Boolean(token))
  const [error, setError] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setEvents([])
      setError(false)
      return
    }

    setLoading(true)
    const controller = new AbortController()

    async function loadTodayEvents() {
      try {
        const response = await fetch(buildCalendarEventsUrl(), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Calendar API error: ${response.status}`)
        }

        const data = (await response.json()) as CalendarEventsResponse
        setEvents(mapCalendarEvents(data.items ?? []))
        setError(false)
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error('Error al cargar eventos de Calendar:', err)
          setError(true)
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    loadTodayEvents()

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

  const todayLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  if (token && loading) {
    return <CalendarWidgetSkeleton />
  }

  return (
    <section className="card-minimal overflow-hidden dark:bg-zinc-900">
      <div className="p-4 lg:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-primary">
            <Calendar className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-neutral-900 dark:text-gray-100">
              Google Calendar
            </p>
            <p className="truncate text-xs capitalize text-neutral-500 dark:text-gray-400">
              {todayLabel}
            </p>
          </div>
        </div>

        {!token ? (
          <div className="mb-4">
            <p className="mb-3 text-sm text-neutral-500 dark:text-gray-400">
              Conectá tu cuenta de Google para ver tus eventos de hoy.
            </p>
            <button
              type="button"
              onClick={handleConnectGoogle}
              disabled={connecting}
              className="inline-flex w-full items-center justify-center rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:border-brand-primary/30 hover:bg-neutral-50 hover:text-brand-primary disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-100 dark:hover:border-brand-primary/40 dark:hover:bg-zinc-700 dark:hover:text-brand-primary"
            >
              {connecting ? 'Conectando...' : 'Conectar Google'}
            </button>
          </div>
        ) : error ? (
          <p className="text-sm text-neutral-500 dark:text-gray-400">
            No se pudieron cargar los eventos de hoy.
          </p>
        ) : events.length === 0 ? (
          <p className="text-sm text-neutral-500 dark:text-gray-400">
            No hay eventos programados para hoy
          </p>
        ) : (
          <ul className="space-y-2.5">
            {events.map((event, index) => (
              <li
                key={`${event.startTime}-${event.summary}-${index}`}
                className="flex items-start gap-3 rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-800/40"
              >
                <span className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-brand-primary">
                  {event.startTime}
                </span>
                <span className="min-w-0 flex-1 text-sm text-neutral-800 dark:text-gray-200">
                  {event.summary}
                </span>
              </li>
            ))}
          </ul>
        )}

        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-800 transition-colors hover:border-brand-primary/30 hover:bg-neutral-50 hover:text-brand-primary dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-100 dark:hover:border-brand-primary/40 dark:hover:bg-zinc-700 dark:hover:text-brand-primary"
        >
          Abrir Calendar
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </section>
  )
}
