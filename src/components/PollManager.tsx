import { BarChart3, CheckCircle2, Pencil, Plus, Trash2, X, Zap } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { formatExpiryLabel, isContentExpired } from '../services/contentExpiry'
import {
  activatePoll,
  createPoll,
  deletePoll,
  datetimeLocalToTimestamp,
  getPolls,
  getVotePercentages,
  timestampToDatetimeLocal,
  updatePoll,
  type Poll,
} from '../services/pollService'

const MAX_OPTIONS = 4

function formatPollDate(date: Poll['createdAt']) {
  const value = date instanceof Date ? date : date.toDate()
  return value.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function PollResults({ poll }: { poll: Poll }) {
  const percentages = getVotePercentages(poll)
  const totalVotes = poll.votes.reduce((sum, count) => sum + count, 0)

  return (
    <div className="space-y-3">
      {poll.options.map((option, index) => (
        <div key={index}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{option}</span>
            <span className="text-gray-500 dark:text-gray-400">
              {poll.votes[index]} ({percentages[index]}%)
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-brand-primary transition-all duration-500"
              style={{ width: `${percentages[index]}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-gray-400">{totalVotes} votos en total</p>
    </div>
  )
}

function resetPollForm(
  setters: {
    setQuestion: (v: string) => void
    setImageUrl: (v: string) => void
    setOptions: (v: string[]) => void
    setExpiresAt: (v: string) => void
    setEditingId: (v: string | null) => void
  },
) {
  setters.setQuestion('')
  setters.setImageUrl('')
  setters.setOptions(['', ''])
  setters.setExpiresAt('')
  setters.setEditingId(null)
}

export function PollManager() {
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [question, setQuestion] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [expiresAt, setExpiresAt] = useState('')

  const loadPolls = useCallback(async () => {
    try {
      const data = await getPolls()
      setPolls(data)
      setError(null)
    } catch (err) {
      console.error('Error al cargar encuestas:', err)
      setPolls([])
      setError('No se pudieron cargar las encuestas.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPolls()
  }, [loadPolls])

  const addOption = () => {
    if (options.length < MAX_OPTIONS) {
      setOptions([...options, ''])
    }
  }

  const removeOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index))
    }
  }

  const updateOption = (index: number, value: string) => {
    setOptions(options.map((opt, i) => (i === index ? value : opt)))
  }

  const handleEdit = (poll: Poll) => {
    if (!poll.id) return

    setEditingId(poll.id)
    setQuestion(poll.question)
    setImageUrl(poll.imageUrl ?? '')
    setOptions(poll.options.length >= 2 ? poll.options : ['', ''])
    setExpiresAt(timestampToDatetimeLocal(poll.expiresAt))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    resetPollForm({ setQuestion, setImageUrl, setOptions, setExpiresAt, setEditingId })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const validOptions = options.map((o) => o.trim()).filter(Boolean)
    if (validOptions.length < 2) {
      toast.error('Ingresá al menos 2 opciones')
      return
    }

    setSubmitting(true)

    const payload = {
      question,
      options: validOptions,
      ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      expiresAt: datetimeLocalToTimestamp(expiresAt),
    }

    try {
      if (editingId) {
        await updatePoll(editingId, payload)
        toast.success('Encuesta actualizada')
      } else {
        await createPoll(payload)
        toast.success('Encuesta creada. Activála cuando quieras publicarla.')
      }

      handleCancelEdit()
      await loadPolls()
    } catch (err) {
      console.error('Error al guardar encuesta:', err)
      toast.error(editingId ? 'Error al actualizar la encuesta' : 'Error al crear la encuesta')
    } finally {
      setSubmitting(false)
    }
  }

  const handleActivate = async (id: string) => {
    setActivatingId(id)

    try {
      await activatePoll(id)
      toast.success('Encuesta activada')
      await loadPolls()
    } catch (err) {
      console.error('Error al activar encuesta:', err)
      toast.error(
        err instanceof Error && err.message.includes('vencida')
          ? 'No se puede activar una encuesta vencida'
          : 'Error al activar la encuesta',
      )
    } finally {
      setActivatingId(null)
    }
  }

  const handleDelete = async (id: string, pollQuestion: string) => {
    const confirmed = window.confirm(
      `¿Eliminar la encuesta "${pollQuestion}"? Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    setDeletingId(id)

    try {
      await deletePoll(id)
      toast.success('Encuesta eliminada')
      if (editingId === id) handleCancelEdit()
      await loadPolls()
    } catch {
      toast.error('Error al eliminar la encuesta')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <section className="card-minimal overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">
                {editingId ? 'Editar encuesta' : 'Nueva encuesta rápida'}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-gray-400">
                {editingId
                  ? 'Modificá la pregunta, opciones o caducidad'
                  : 'Creá una pregunta con hasta 4 opciones de respuesta'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label htmlFor="poll-question" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
              Pregunta
            </label>
            <input
              id="poll-question"
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ej: ¿Qué beneficio te gustaría para el próximo mes?"
              className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"
            />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label htmlFor="poll-image" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
                URL de portada <span className="font-normal text-neutral-400">(opcional)</span>
              </label>
              <input
                id="poll-image"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://ejemplo.com/portada.jpg"
                className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"
              />
              {imageUrl && (
                <div className="mt-3 overflow-hidden rounded-lg border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 p-3">
                  <img
                    src={imageUrl}
                    alt="Vista previa de portada"
                    className="mx-auto max-h-36 rounded object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                </div>
              )}
            </div>

            <div>
              <label htmlFor="poll-expires" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
                Fecha de Caducidad <span className="font-normal text-neutral-400">(Opcional)</span>
              </label>
              <input
                id="poll-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-700 dark:text-gray-300">Opciones</p>
              {options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary hover:text-red-950"
                >
                  <Plus className="h-4 w-4" />
                  Agregar opción
                </button>
              )}
            </div>
            <div className="space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    required={index < 2}
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Opción ${index + 1}`}
                    className="input-brand-focus flex-1 rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-2.5 text-sm"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      aria-label={`Eliminar opción ${index + 1}`}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-zinc-800 text-neutral-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-100 dark:border-zinc-800 pt-5">
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary rounded-lg px-6 py-2.5 text-sm font-semibold"
            >
              {submitting
                ? editingId
                  ? 'Guardando...'
                  : 'Creando...'
                : editingId
                  ? 'Guardar cambios'
                  : 'Crear encuesta'}
            </button>
          </div>
        </form>
      </section>

      <section className="card-minimal overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-zinc-800 px-6 py-5">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">Encuestas</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            Activá una encuesta para mostrarla en la intranet
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner-brand h-8 w-8 animate-spin rounded-full border-4" />
          </div>
        ) : error ? (
          <p className="px-6 py-16 text-center text-sm text-red-600">{error}</p>
        ) : polls.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-neutral-500 dark:text-gray-400">
            Aún no hay encuestas creadas.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-zinc-800">
            {polls.map((poll) => {
              const expired = isContentExpired(poll.expiresAt)
              const expiryLabel = formatExpiryLabel(poll.expiresAt)

              return (
                <div key={poll.id} className={`p-6 ${expired ? 'opacity-60' : ''}`}>
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {poll.imageUrl && (
                        <div className="mb-3 overflow-hidden rounded-lg border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950">
                          <img
                            src={poll.imageUrl}
                            alt=""
                            className="mx-auto max-h-32 w-full object-contain"
                          />
                        </div>
                      )}
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {poll.active ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-brand-primary ring-1 ring-red-100 dark:bg-red-950/40">
                            <CheckCircle2 className="h-3 w-3" />
                            Activa
                          </span>
                        ) : (
                          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-500 dark:bg-zinc-800 dark:text-gray-400">
                            Inactiva
                          </span>
                        )}
                        {expired && (
                          <span className="rounded-full bg-neutral-200 px-2.5 py-0.5 text-xs font-medium text-neutral-600 dark:bg-zinc-700 dark:text-gray-300">
                            Vencida
                          </span>
                        )}
                        <span className="text-xs text-neutral-400">{formatPollDate(poll.createdAt)}</span>
                        {expiryLabel && (
                          <span className="text-xs text-neutral-400">· {expiryLabel}</span>
                        )}
                      </div>
                      <h3 className="font-semibold text-neutral-900 dark:text-gray-100">{poll.question}</h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!poll.active && poll.id && !expired && (
                        <button
                          type="button"
                          onClick={() => handleActivate(poll.id!)}
                          disabled={activatingId === poll.id}
                          className="btn-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                        >
                          <Zap className="h-4 w-4" />
                          {activatingId === poll.id ? 'Activando...' : 'Activar'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleEdit(poll)}
                        aria-label={`Editar encuesta ${poll.question}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-800 dark:border-zinc-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {poll.id && (
                        <button
                          type="button"
                          onClick={() => handleDelete(poll.id!, poll.question)}
                          disabled={deletingId === poll.id}
                          aria-label={`Eliminar encuesta ${poll.question}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <PollResults poll={poll} />
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
