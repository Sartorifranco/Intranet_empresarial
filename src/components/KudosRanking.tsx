import { Medal, Trophy } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  getMonthLabel,
  getMonthlyKudosRanking,
  KUDO_BADGE_EMOJI,
  type KudoRankingEntry,
} from '../services/kudosService'

const RANK_STYLES = [
  'bg-amber-100 text-amber-800 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300',
  'bg-neutral-200 text-neutral-700 ring-neutral-300 dark:bg-zinc-700 dark:text-gray-200',
  'bg-orange-100 text-orange-800 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300',
]

function RankIcon({ position }: { position: number }) {
  if (position === 0) return <Trophy className="h-4 w-4 text-amber-500" />
  if (position === 1) return <Medal className="h-4 w-4 text-neutral-400" />
  if (position === 2) return <Medal className="h-4 w-4 text-orange-600" />
  return (
    <span className="flex h-5 w-5 items-center justify-center text-xs font-bold text-neutral-400">
      {position + 1}
    </span>
  )
}

export function KudosRanking({
  limit = 5,
  compact = false,
  refreshToken = 0,
}: {
  limit?: number
  compact?: boolean
  refreshToken?: number
}) {
  const now = new Date()
  const [ranking, setRanking] = useState<KudoRankingEntry[]>([])
  const [loading, setLoading] = useState(true)

  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const monthLabel = getMonthLabel(year, month)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMonthlyKudosRanking(year, month)
      setRanking(data.slice(0, limit))
    } catch (err) {
      console.error('Error al cargar ranking de kudos:', err)
      setRanking([])
    } finally {
      setLoading(false)
    }
  }, [year, month, limit, refreshToken])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100 dark:bg-zinc-800" />
        ))}
      </div>
    )
  }

  if (ranking.length === 0) {
    return (
      <p className="text-center text-xs text-neutral-500 dark:text-gray-400">
        Aún no hay reconocimientos este mes. ¡Sé el primero en enviar uno!
      </p>
    )
  }

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-brand-primary">
        Ranking {monthLabel}
      </p>
      <ul className={compact ? 'space-y-2' : 'space-y-3'}>
        {ranking.map((entry, index) => {
          const topBadge = (Object.entries(entry.badges) as [keyof typeof entry.badges, number][])
            .sort((a, b) => b[1] - a[1])
            .find(([, count]) => count > 0)?.[0]

          return (
            <li
              key={entry.recipient}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
                index < 3
                  ? `ring-1 ${RANK_STYLES[index]}`
                  : 'border-neutral-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
              }`}
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center">
                <RankIcon position={index} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-neutral-900 dark:text-gray-100">
                  {entry.recipient}
                </p>
                {topBadge && (
                  <p className="text-[10px] text-neutral-500 dark:text-gray-400">
                    {KUDO_BADGE_EMOJI[topBadge]} Más {topBadge.toLowerCase()}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold text-brand-primary">{entry.count}</p>
                <p className="text-[10px] text-neutral-400">
                  {entry.count === 1 ? 'kudo' : 'kudos'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
