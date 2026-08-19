import { BarChart3, CalendarHeart, Vote } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  getDailyQuestion,
  getVotePercentages,
  getYesterdayDateKey,
  subscribeDailyQuestion,
  voteDailyQuestion,
  type DailyQuestion,
} from '../services/dailyQuestionService'
import { formatDateKeyLabel, getTodayDateKey } from '../utils/weekUtils'

function ResultsView({ question }: { question: DailyQuestion }) {
  const percentages = getVotePercentages(question)
  const totalVotes = question.votes.reduce((sum, count) => sum + count, 0)

  return (
    <div className="space-y-3">
      <p className="text-center text-sm font-semibold text-neutral-900 dark:text-gray-100">
        {question.question}
      </p>
      {question.options.map((option, index) => (
        <div key={index}>
          <div className="mb-1.5 flex items-start justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 break-words font-medium text-neutral-800 dark:text-gray-100">
              {option}
            </span>
            <span className="shrink-0 text-neutral-500 dark:text-gray-400">
              {percentages[index]}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-brand-primary transition-all duration-700 ease-out"
              style={{ width: `${percentages[index]}%` }}
            />
          </div>
        </div>
      ))}
      <p className="pt-1 text-center text-xs text-neutral-400">
        {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
      </p>
    </div>
  )
}

function DailyQuestionSkeleton() {
  return (
    <div className="card-minimal animate-pulse overflow-hidden">
      <div className="h-14 bg-neutral-100 dark:bg-zinc-800" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-2/3 rounded bg-neutral-100 dark:bg-zinc-800" />
        <div className="h-10 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
        <div className="h-10 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
      </div>
    </div>
  )
}

export function DailyQuestionWidget() {
  const todayKey = getTodayDateKey()
  const yesterdayKey = getYesterdayDateKey()

  const [todayQuestion, setTodayQuestion] = useState<DailyQuestion | null>(null)
  const [yesterdayQuestion, setYesterdayQuestion] = useState<DailyQuestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [votedDates, setVotedDates] = useLocalStorage<Record<string, boolean>>(
    'intranet_daily_votes',
    {},
  )

  useEffect(() => {
    const unsubscribe = subscribeDailyQuestion(
      todayKey,
      (question) => {
        setTodayQuestion(question)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [todayKey])

  useEffect(() => {
    getDailyQuestion(yesterdayKey).then(setYesterdayQuestion).catch(() => setYesterdayQuestion(null))
  }, [yesterdayKey])

  const hasVotedToday = Boolean(votedDates[todayKey])

  const handleVote = async (optionIndex: number) => {
    if (!todayQuestion || hasVotedToday) return

    setVoting(true)
    try {
      await voteDailyQuestion(todayKey, optionIndex)
      setVotedDates((prev) => ({ ...prev, [todayKey]: true }))
      toast.success('¡Gracias! Mañana verás los resultados.')
    } catch (err) {
      console.error('Error al votar pregunta del día:', err)
      toast.error('No se pudo registrar tu voto')
    } finally {
      setVoting(false)
    }
  }

  if (loading) {
    return <DailyQuestionSkeleton />
  }

  const showYesterdayResults = yesterdayQuestion !== null
  const showToday = todayQuestion !== null

  if (!showToday && !showYesterdayResults) {
    return null
  }

  return (
    <div className="card-minimal overflow-hidden">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 lg:px-5 lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-white">
            <CalendarHeart className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-gray-100">
              Pregunta del día
            </h2>
            <p className="text-xs capitalize text-neutral-500 dark:text-gray-400">
              {formatDateKeyLabel(todayKey)}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-5 overflow-hidden p-4 lg:p-5">
        {showYesterdayResults && (
          <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-brand-primary">
              <BarChart3 className="h-3.5 w-3.5" />
              Resultados de ayer
            </div>
            <ResultsView question={yesterdayQuestion} />
          </div>
        )}

        {showToday && (
          <div>
            {hasVotedToday ? (
              <div className="rounded-xl border border-dashed border-brand-primary/30 bg-red-50/50 px-4 py-6 text-center dark:bg-red-950/20">
                <p className="text-sm font-semibold text-neutral-900 dark:text-gray-100">
                  ¡Gracias por participar!
                </p>
                <p className="mt-1 text-xs text-neutral-500 dark:text-gray-400">
                  Los resultados de hoy se publican mañana
                </p>
              </div>
            ) : (
              <>
                <p className="mb-4 break-words text-center text-sm font-semibold text-neutral-900 dark:text-gray-100 sm:text-base">
                  {todayQuestion.question}
                </p>
                <div className="space-y-2">
                  {todayQuestion.options.map((option, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleVote(index)}
                      disabled={voting}
                      className="flex w-full items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-3 text-left text-sm font-medium break-words text-neutral-800 transition-all hover:border-red-200 hover:bg-red-50 hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-gray-100 dark:hover:border-red-900/50 dark:hover:bg-red-950/40 sm:px-4"
                    >
                      <Vote className="h-4 w-4 shrink-0 text-brand-primary" />
                      {option}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {!showToday && showYesterdayResults && (
          <p className="text-center text-xs text-neutral-500 dark:text-gray-400">
            La pregunta de hoy se publicará pronto. Volvé a entrar más tarde.
          </p>
        )}
      </div>
    </div>
  )
}
