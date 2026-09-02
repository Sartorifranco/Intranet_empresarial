import { Timestamp } from 'firebase/firestore'
import { Newspaper, Pencil, Trash2, X } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../context'
import { formatExpiryLabel, isContentExpired } from '../services/contentExpiry'
import {
  createNews,
  deleteNews,
  datetimeLocalToTimestamp,
  getNews,
  timestampToDatetimeLocal,
  updateNews,
  type NewsCategory,
  type NewsPost,
} from '../services/newsService'

const CATEGORIES: { label: string; value: NewsCategory }[] = [
  { label: 'General', value: 'General' },
  { label: 'RRHH', value: 'Recursos Humanos' },
  { label: 'Sistemas', value: 'Sistemas' },
]

function formatDate(date: Timestamp | Date) {
  const value = date instanceof Timestamp ? date.toDate() : date
  return value.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function resetForm(
  setters: {
    setTitle: (v: string) => void
    setContent: (v: string) => void
    setImageUrl: (v: string) => void
    setCategory: (v: NewsCategory) => void
    setExpiresAt: (v: string) => void
    setEditingId: (v: string | null) => void
  },
) {
  setters.setTitle('')
  setters.setContent('')
  setters.setImageUrl('')
  setters.setCategory('General')
  setters.setExpiresAt('')
  setters.setEditingId(null)
}

export function NewsManager() {
  const { user } = useAuth()
  const [news, setNews] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [category, setCategory] = useState<NewsCategory>('General')
  const [expiresAt, setExpiresAt] = useState('')

  const loadNews = useCallback(async () => {
    try {
      const data = await getNews({ includeExpired: true })
      setNews(data)
      setError(null)
    } catch (err) {
      console.error('Error al cargar las noticias:', err)
      setNews([])
      setError('No se pudieron cargar las noticias. Intentá nuevamente.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadNews()
  }, [loadNews])

  const handleEdit = (post: NewsPost) => {
    if (!post.id) return

    setEditingId(post.id)
    setTitle(post.title)
    setContent(post.content)
    setImageUrl(post.imageUrl ?? '')
    setCategory(post.category)
    setExpiresAt(timestampToDatetimeLocal(post.expiresAt))
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleCancelEdit = () => {
    resetForm({ setTitle, setContent, setImageUrl, setCategory, setExpiresAt, setEditingId })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!user?.email) {
      toast.error('No hay un usuario autenticado')
      return
    }

    setSubmitting(true)

    const payload = {
      title: title.trim(),
      content: content.trim(),
      author: user.email,
      category,
      ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
      expiresAt: datetimeLocalToTimestamp(expiresAt),
    }

    try {
      if (editingId) {
        await updateNews(editingId, payload)
        toast.success('Comunicado actualizado')
      } else {
        await createNews(payload)
        toast.success('Noticia publicada correctamente')
      }

      handleCancelEdit()
      await loadNews()
    } catch {
      toast.error(editingId ? 'Error al actualizar la noticia' : 'Error al publicar la noticia')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, newsTitle: string) => {
    const confirmed = window.confirm(
      `¿Eliminar la noticia "${newsTitle}"? Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    setDeletingId(id)

    try {
      await deleteNews(id)
      toast.success('Noticia eliminada')
      if (editingId === id) handleCancelEdit()
      await loadNews()
    } catch {
      toast.error('Error al eliminar la noticia')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-gray-100 bg-neutral-50 px-6 py-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-primary text-white">
              <Newspaper className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingId ? 'Editar comunicado' : 'Publicar comunicado'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {editingId
                  ? 'Modificá los datos y guardá los cambios'
                  : 'El contenido será visible para todos los empleados en la intranet'}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label htmlFor="news-title" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Título
              </label>
              <input
                id="news-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Nueva política de vacaciones"
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition-all placeholder:text-gray-400 input-brand-focus focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-brand-primary/10"
              />
            </div>

            <div>
              <label htmlFor="news-category" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Categoría
              </label>
              <select
                id="news-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as NewsCategory)}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition-all input-brand-focus focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-brand-primary/10"
              >
                {CATEGORIES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label htmlFor="news-image" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                URL de imagen <span className="font-normal text-gray-400">(opcional)</span>
              </label>
              <input
                id="news-image"
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition-all placeholder:text-gray-400 input-brand-focus focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-brand-primary/10"
              />
            </div>

            <div>
              <label htmlFor="news-expires" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Fecha de Caducidad <span className="font-normal text-gray-400">(Opcional)</span>
              </label>
              <input
                id="news-expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 outline-none transition-all input-brand-focus focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-brand-primary/10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="news-content" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contenido del comunicado
            </label>
            <textarea
              id="news-content"
              required
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Redactá el comunicado que verán los empleados..."
              className="w-full resize-y rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/60 px-4 py-3 text-sm leading-relaxed text-gray-900 dark:text-gray-100 outline-none transition-all placeholder:text-gray-400 input-brand-focus focus:bg-white dark:focus:bg-zinc-900 focus:ring-4 focus:ring-brand-primary/10"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-5 dark:border-zinc-800">
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary rounded-xl px-6 py-2.5 text-sm font-semibold"
            >
              {submitting
                ? editingId
                  ? 'Guardando...'
                  : 'Publicando...'
                : editingId
                  ? 'Guardar cambios'
                  : 'Publicar'}
            </button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-gray-100 px-6 py-5 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Noticias publicadas</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {news.length} {news.length === 1 ? 'comunicado' : 'comunicados'} en total
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-700 border-t-transparent" />
          </div>
        ) : error ? (
          <p className="px-6 py-16 text-center text-sm text-danger">{error}</p>
        ) : news.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-gray-500 dark:text-gray-400">
            Aún no hay noticias publicadas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-900/60 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-6 py-3">Título</th>
                  <th className="px-6 py-3">Categoría</th>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3">Caducidad</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {news.map((post) => {
                  const expiryLabel = formatExpiryLabel(post.expiresAt)
                  const expired = isContentExpired(post.expiresAt)

                  return (
                    <tr
                      key={post.id}
                      className={`transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50 ${expired ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-100">{post.title}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                          {post.category === 'Recursos Humanos' ? 'RRHH' : post.category}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-gray-500 dark:text-gray-400">
                        {formatDate(post.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 dark:text-gray-400">
                        {expiryLabel ?? '—'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(post)}
                            aria-label={`Editar ${post.title}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => post.id && handleDelete(post.id, post.title)}
                            disabled={deletingId === post.id}
                            aria-label={`Eliminar ${post.title}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-danger transition-colors hover:bg-brand-tint hover:text-danger disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-brand-primary-hover/40 dark:hover:text-brand-primary"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
