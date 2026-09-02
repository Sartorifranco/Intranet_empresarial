import { Timestamp } from 'firebase/firestore'
import { Sparkles } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { SendKudo } from './SendKudo'
import { KudosRanking } from './KudosRanking'
import {
  getLatestKudos,
  KUDO_BADGE_EMOJI,
  type Kudo,
  type KudoBadge,
} from '../services/kudosService'

const BADGE_STYLES: Record<
  KudoBadge,
  { accent: string; border: string; badge: string }
> = {
  Compañerismo: {
    accent: 'bg-cyan-500',
    border: 'border-cyan-200',
    badge: 'bg-cyan-100 text-cyan-800',
  },
  Liderazgo: {
    accent: 'bg-amber-500',
    border: 'border-amber-200 dark:border-amber-900/50',
    badge: 'bg-amber-100 text-amber-800 dark:text-amber-300',
  },
  'Gran Esfuerzo': {
    accent: 'bg-rose-500',
    border: 'border-rose-200',
    badge: 'bg-rose-100 text-rose-800',
  },
}

function formatKudoDate(date: Timestamp | Date) {
  const value = date instanceof Timestamp ? date.toDate() : date
  return value.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function KudosSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6"
        >
          <div className="mb-4 h-6 w-24 rounded-full bg-gray-200" />
          <div className="mb-3 h-5 w-3/4 rounded bg-gray-200" />
          <div className="h-12 rounded-lg bg-gray-100 dark:bg-zinc-800" />
        </div>
      ))}
    </div>
  )
}

export function KudosWall({ variant = 'default' }: { variant?: 'default' | 'sidebar' }) {
  const [kudos, setKudos] = useState<Kudo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rankingRefresh, setRankingRefresh] = useState(0)
  const sidebar = variant === 'sidebar'

  const loadKudos = useCallback(async () => {
    try {
      const data = await getLatestKudos()
      setKudos(data)
      setError(null)
    } catch (err) {
      console.error('Error al cargar reconocimientos:', err)
      setKudos([])
      setError('No se pudieron cargar los reconocimientos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadKudos()
  }, [loadKudos])

  const handleKudoSent = () => {
    loadKudos()
    setRankingRefresh((n) => n + 1)
  }

  if (sidebar) {
    const recentKudos = kudos.slice(0, 4)

    return (
      <section className="card-minimal overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 px-4 py-4 lg:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-neutral-900 dark:text-gray-100">Reconocimientos</h2>
                <p className="break-words text-xs text-neutral-500 dark:text-gray-400">Celebrá a tus compañeros</p>
              </div>
            </div>
            <div className="w-full shrink-0 sm:w-auto">
              <SendKudo onSent={handleKudoSent} />
            </div>
          </div>
        </div>

        <div className="overflow-hidden p-4 lg:p-5">
          <KudosRanking compact refreshToken={rankingRefresh} />

          <div className="my-4 border-t border-neutral-100 dark:border-zinc-800" />

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-neutral-100 dark:bg-zinc-800" />
              ))}
            </div>
          ) : error ? (
            <p className="text-sm text-danger">{error}</p>
          ) : recentKudos.length === 0 ? (
            <p className="text-center text-sm text-neutral-500 dark:text-gray-400">
              Aún no hay reconocimientos. ¡Sé el primero!
            </p>
          ) : (
            <ul className="space-y-3">
              {recentKudos.map((kudo) => {
                const styles = BADGE_STYLES[kudo.badge]

                return (
                  <li
                    key={kudo.id}
                    className="overflow-hidden rounded-lg border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950/50 p-3 sm:p-4"
                  >
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${styles.badge}`}
                      >
                        {KUDO_BADGE_EMOJI[kudo.badge]} {kudo.badge}
                      </span>
                      <time className="shrink-0 text-xs text-neutral-400">
                        {formatKudoDate(kudo.createdAt)}
                      </time>
                    </div>
                    <p className="break-words text-sm text-neutral-800 dark:text-gray-100">
                      <span className="font-semibold text-brand-primary">{kudo.sender}</span>
                      <span className="text-neutral-500 dark:text-gray-400"> → </span>
                      <span className="font-semibold">{kudo.recipient}</span>
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-neutral-600 dark:text-gray-400">
                      &ldquo;{kudo.message}&rdquo;
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="overflow-hidden rounded-xl border border-rose-100 bg-rose-50/40 p-6 dark:border-rose-900/30 dark:bg-rose-950/20 sm:p-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-rose-200 bg-rose-600 text-white dark:border-rose-800">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Muro de reconocimientos</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Celebrá el trabajo de tus compañeros
            </p>
          </div>
        </div>
        <SendKudo onSent={handleKudoSent} />
      </div>

      <div className="mb-6 rounded-2xl border border-rose-100 bg-white/80 p-5 dark:border-rose-900/30 dark:bg-zinc-900/60">
        <KudosRanking limit={8} refreshToken={rankingRefresh} />
      </div>

      {loading ? (
        <KudosSkeleton />
      ) : error ? (
        <p className="rounded-xl bg-brand-tint px-4 py-8 text-center text-sm text-danger">{error}</p>
      ) : kudos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-rose-200 bg-white dark:bg-zinc-900/60 px-6 py-12 text-center">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Aún no hay reconocimientos publicados.
          </p>
          <p className="mt-1 text-sm text-gray-400">
            ¡Sé el primero en felicitar a un compañero!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {kudos.map((kudo) => {
            const styles = BADGE_STYLES[kudo.badge]

            return (
              <article
                key={kudo.id}
                className={`relative overflow-hidden rounded-xl border bg-white dark:bg-zinc-900 ${styles.border}`}
              >
                <div className={`h-1 ${styles.accent}`} />

                <div className="p-5">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${styles.badge}`}
                    >
                      <span>{KUDO_BADGE_EMOJI[kudo.badge]}</span>
                      {kudo.badge}
                    </span>
                    <time className="text-xs text-gray-400">
                      {formatKudoDate(kudo.createdAt)}
                    </time>
                  </div>

                  <p className="mb-3 text-base leading-snug text-gray-900 dark:text-gray-100">
                    <span className="font-bold text-rose-600">{kudo.sender}</span>
                    <span className="text-gray-500 dark:text-gray-400"> reconoció a </span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{kudo.recipient}</span>
                  </p>

                  <blockquote className="rounded-xl bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm italic leading-relaxed text-gray-700 dark:text-gray-300">
                    &ldquo;{kudo.message}&rdquo;
                  </blockquote>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
