import { CalendarHeart, Pencil, Plus, Trash2, X } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  deleteDailyQuestion,
  getDailyQuestions,
  getVotePercentages,
  saveDailyQuestion,
  type DailyQuestion,
} from '../services/dailyQuestionService'
import { addDays, formatDateKeyLabel, getTodayDateKey } from '../utils/weekUtils'

const MAX_OPTIONS = 4

function QuestionResults({ question }: { question: DailyQuestion }) {
  const percentages = getVotePercentages(question)
  const totalVotes = question.votes.reduce((sum, count) => sum + count, 0)

  return (
    <div className="space-y-2 mt-3">
      {question.options.map((option, index) => (
        <div key={index} className="mb-2">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-neutral-700 dark:text-gray-300">{option}</span>
            <span className="text-neutral-500">
              {question.votes[index]} ({percentages[index]}%)
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-brand-primary"
              style={{ width: `${percentages[index]}%` }}
            />
          </div>
        </div>
      ))}
      <p className="text-xs text-neutral-400">{totalVotes} votos</p>
    </div>
  )
}

export function DailyQuestionManager() {
  const [questions, setQuestions] = useState<DailyQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [dateKey, setDateKey] = useState(getTodayDateKey())
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])

  const loadQuestions = useCallback(async () => {
    try {
      const data = await getDailyQuestions()
      setQuestions(data)
    } catch (err) {
      console.error('Error al cargar preguntas del día:', err)
      toast.error('No se pudieron cargar las preguntas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadQuestions()
  }, [loadQuestions])

  const resetForm = () => {
    setEditingKey(null)
    setDateKey(addDays(getTodayDateKey(), 1))
    setQuestion('')
    setOptions(['', ''])
  }

  const handleEdit = (item: DailyQuestion) => {
    setEditingKey(item.dateKey)
    setDateKey(item.dateKey)
    setQuestion(item.question)
    setOptions(item.options.length >= 2 ? item.options : ['', ''])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const validOptions = options.map((o) => o.trim()).filter(Boolean)
    if (validOptions.length < 2) {
      toast.error('Ingresá al menos 2 opciones')
      return
    }

    setSubmitting(true)
    try {
      await saveDailyQuestion(dateKey, { question, options: validOptions })
      toast.success(editingKey ? 'Pregunta actualizada' : 'Pregunta programada')
      resetForm()
      await loadQuestions()
    } catch (err) {
      console.error('Error al guardar pregunta:', err)
      toast.error('No se pudo guardar la pregunta')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (key: string, label: string) => {
    if (!window.confirm(`¿Eliminar la pregunta del ${label}?`)) return

    setDeletingKey(key)
    try {
      await deleteDailyQuestion(key)
      toast.success('Pregunta eliminada')
      if (editingKey === key) resetForm()
      await loadQuestions()
    } catch {
      toast.error('No se pudo eliminar')
    } finally {
      setDeletingKey(null)
    }
  }

  const todayKey = getTodayDateKey()

  return (
    <div className="space-y-8">
      <section className="card-minimal overflow-hidden">
        <div className="border-b border-neutral-200 bg-neutral-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary text-white">
              <CalendarHeart className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">
                {editingKey ? 'Editar pregunta del día' : 'Programar pregunta del día'}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-gray-400">
                Una pregunta por fecha. Los resultados se muestran al día siguiente.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div>
            <label htmlFor="daily-date" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
              Fecha de publicación
            </label>
            <input
              id="daily-date"
              type="date"
              required
              value={dateKey}
              onChange={(e) => setDateKey(e.target.value)}
              className="input-brand-focus w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <p className="mt-1 text-xs text-neutral-500 capitalize">
              {formatDateKeyLabel(dateKey)}
            </p>
          </div>

          <div>
            <label htmlFor="daily-question" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
              Pregunta
            </label>
            <input
              id="daily-question"
              type="text"
              required
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ej: ¿Mate con o sin azúcar?"
              className="input-brand-focus w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-neutral-700 dark:text-gray-300">Opciones</p>
              {options.length < MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={addOption}
                  className="inline-flex items-center gap-1 text-sm font-medium text-brand-primary"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
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
                    onChange={(e) =>
                      setOptions(options.map((opt, i) => (i === index ? e.target.value : opt)))
                    }
                    placeholder={`Opción ${index + 1}`}
                    className="input-brand-focus flex-1 rounded-lg border border-neutral-300 px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:text-red-600 dark:border-zinc-800"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-100 pt-5 dark:border-zinc-800">
            {editingKey && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 px-5 py-2.5 text-sm font-medium dark:border-zinc-700"
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
              {submitting ? 'Guardando…' : editingKey ? 'Guardar cambios' : 'Programar pregunta'}
            </button>
          </div>
        </form>
      </section>

      <section className="card-minimal overflow-hidden">
        <div className="border-b border-neutral-200 px-6 py-5 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">
            Calendario de preguntas
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="spinner-brand h-8 w-8 animate-spin rounded-full border-4" />
          </div>
        ) : questions.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-neutral-500">
            No hay preguntas programadas.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-zinc-800">
            {questions.map((item) => {
              const isToday = item.dateKey === todayKey
              const isPast = item.dateKey < todayKey

              return (
                <div key={item.dateKey} className="p-6">
                  <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {isToday && (
                          <span className="rounded-full bg-brand-primary/10 px-2 py-0.5 text-xs font-semibold text-brand-primary">
                            Hoy
                          </span>
                        )}
                        {isPast && (
                          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-zinc-800">
                            Finalizada
                          </span>
                        )}
                        <span className="text-xs capitalize text-neutral-400">
                          {formatDateKeyLabel(item.dateKey)}
                        </span>
                      </div>
                      <h3 className="font-semibold text-neutral-900 dark:text-gray-100">
                        {item.question}
                      </h3>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 dark:border-zinc-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.dateKey, formatDateKeyLabel(item.dateKey))}
                        disabled={deletingKey === item.dateKey}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {isPast && <QuestionResults question={item} />}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
