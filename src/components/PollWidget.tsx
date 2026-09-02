import { BarChart3, Vote } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useLocalStorage } from '../hooks/useLocalStorage'
import {
  getVotePercentages,
  subscribeActivePoll,
  votePoll,
  type Poll,
} from '../services/pollService'

function PollSkeleton() {
  return (
    <div className="card-minimal animate-pulse overflow-hidden">
      <div className="h-36 bg-neutral-100 dark:bg-zinc-800" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-2/3 rounded bg-neutral-100 dark:bg-zinc-800" />
        <div className="h-10 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
        <div className="h-10 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
      </div>
    </div>
  )
}

function PollResultsView({ poll }: { poll: Poll }) {
  const percentages = getVotePercentages(poll)
  const totalVotes = poll.votes.reduce((sum, count) => sum + count, 0)

  return (
    <div className="space-y-3">
      {poll.options.map((option, index) => (
        <div key={index}>
          <div className="mb-1.5 flex items-start justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 break-words font-medium text-neutral-800 dark:text-gray-100">{option}</span>
            <span className="shrink-0 text-neutral-500 dark:text-gray-400">{percentages[index]}%</span>
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
        {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'} registrados
      </p>
    </div>
  )
}

export function PollWidget() {
  const [poll, setPoll] = useState<Poll | null>(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(false)
  const [votedPolls, setVotedPolls] = useLocalStorage<Record<string, boolean>>(
    'intranet_poll_votes',
    {},
  )

  useEffect(() => {
    const unsubscribe = subscribeActivePoll(
      (activePoll) => {
        setPoll(activePoll)
        setLoading(false)
      },
      () => setLoading(false),
    )

    return unsubscribe
  }, [])

  const hasVoted = poll?.id ? Boolean(votedPolls[poll.id]) : false

  const handleVote = async (optionIndex: number) => {
    if (!poll?.id || hasVoted) return

    setVoting(true)

    try {
      await votePoll(poll.id, optionIndex)
      setVotedPolls((prev) => ({ ...prev, [poll.id!]: true }))
      toast.success('¡Gracias por votar!')
    } catch (err) {
      console.error('Error al votar:', err)
      toast.error('No se pudo registrar tu voto')
    } finally {
      setVoting(false)
    }
  }

  if (loading) {
    return <PollSkeleton />
  }

  if (!poll) {
    return null
  }

  return (
    <div className="card-minimal overflow-hidden">
      {poll.imageUrl && (
        <div className="flex justify-center overflow-hidden border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 px-3 py-3 sm:px-4 sm:py-4">
          <img
            src={poll.imageUrl}
            alt="Portada de la encuesta"
            className="max-h-32 w-full max-w-md rounded-lg object-contain sm:max-h-44"
          />
        </div>
      )}

      <div className="border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 px-4 py-3 lg:px-5 lg:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-primary text-white">
            {hasVoted ? (
              <BarChart3 className="h-4 w-4" />
            ) : (
              <Vote className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-900 dark:text-gray-100">Encuesta rápida</h2>
            <p className="text-xs text-neutral-500 dark:text-gray-400">
              {hasVoted ? 'Resultados en vivo' : 'Tu opinión cuenta'}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden p-4 lg:p-5">
        <p className="mb-4 break-words text-center text-sm font-semibold text-neutral-900 dark:text-gray-100 sm:text-base">
          {poll.question}
        </p>

        {hasVoted ? (
          <PollResultsView poll={poll} />
        ) : (
          <div className="space-y-2">
            {poll.options.map((option, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleVote(index)}
                disabled={voting}
                className="w-full rounded-lg border border-neutral-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-3 text-left text-sm font-medium break-words text-neutral-800 dark:text-gray-100 transition-all hover:border-brand-primary/25 dark:border-brand-primary/40 hover:bg-brand-tint hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-60 sm:px-4"
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
