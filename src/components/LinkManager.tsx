import { ExternalLink, Link2, Pencil, Trash2 } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useInvalidateCatalog, useLinksQuery } from '../hooks/queries/useCatalogQueries'
import {
  createLink,
  deleteLink,
  updateLink,
  type LinkCategory,
  type UsefulLink,
} from '../services/linkService'

const CATEGORIES: LinkCategory[] = ['Herramientas IT', 'Operaciones', 'RRHH']

export function LinkManager() {
  const { data: links = [], isLoading: loading, isError } = useLinksQuery()
  const { invalidateLinks } = useInvalidateCatalog()
  const error = isError ? 'No se pudieron cargar los enlaces. Intentá nuevamente.' : null
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<LinkCategory>('Herramientas IT')

  const linksByCategory = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        category: cat,
        items: links.filter((link) => link.category === cat),
      })).filter((group) => group.items.length > 0),
    [links],
  )

  const resetForm = () => {
    setEditingId(null)
    setTitle('')
    setUrl('')
    setDescription('')
    setCategory('Herramientas IT')
  }

  const handleEdit = (link: UsefulLink) => {
    setEditingId(link.id ?? null)
    setTitle(link.title)
    setUrl(link.url)
    setDescription(link.description)
    setCategory(link.category)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const payload = {
      title: title.trim(),
      url: url.trim(),
      description: description.trim(),
      category,
    }

    try {
      if (editingId) {
        await updateLink(editingId, payload)
        toast.success('Enlace actualizado correctamente')
      } else {
        await createLink(payload)
        toast.success('Enlace guardado correctamente')
      }

      resetForm()
      await invalidateLinks()
    } catch (err) {
      console.error('Error al guardar el enlace:', err)
      toast.error(editingId ? 'Error al actualizar el enlace' : 'Error al guardar el enlace')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string, linkTitle: string) => {
    const confirmed = window.confirm(
      `¿Eliminar el enlace "${linkTitle}"? Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    setDeletingId(id)

    try {
      await deleteLink(id)
      toast.success('Enlace eliminado')
      if (editingId === id) resetForm()
      await invalidateLinks()
    } catch (err) {
      console.error('Error al eliminar el enlace:', err)
      toast.error('Error al eliminar el enlace')
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
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">
                {editingId ? 'Editar acceso directo' : 'Nuevo acceso directo'}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-gray-400">
                Registrá enlaces a sistemas y herramientas de la empresa
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label htmlFor="link-title" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
                Título
              </label>
              <input
                id="link-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Portal SAP"
                className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="link-url" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
                URL
              </label>
              <input
                id="link-url"
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://sistema.empresa.com"
                className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="link-description" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
              Descripción
            </label>
            <textarea
              id="link-description"
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descripción de para qué sirve este sistema..."
              className="input-brand-focus w-full resize-y rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm leading-relaxed"
            />
          </div>

          <div className="max-w-sm">
            <label htmlFor="link-category" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
              Categoría
            </label>
            <select
              id="link-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as LinkCategory)}
              className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-100 dark:border-zinc-800 pt-5">
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-neutral-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium text-neutral-700 dark:text-gray-300 hover:bg-neutral-50 dark:bg-zinc-950"
              >
                Cancelar edición
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary rounded-lg px-6 py-2.5 text-sm font-semibold"
            >
              {submitting
                ? 'Guardando...'
                : editingId
                  ? 'Actualizar enlace'
                  : 'Guardar enlace'}
            </button>
          </div>
        </form>
      </section>

      <section className="card-minimal overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-zinc-800 px-6 py-5">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">Enlaces activos</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            {links.length} {links.length === 1 ? 'enlace' : 'enlaces'} registrados
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner-brand h-8 w-8 animate-spin rounded-full border-4" />
          </div>
        ) : error ? (
          <p className="px-6 py-16 text-center text-sm text-danger">{error}</p>
        ) : links.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-neutral-500 dark:text-gray-400">
            Aún no hay enlaces registrados.
          </p>
        ) : (
          <div className="space-y-6 p-6">
            {linksByCategory.map((group) => (
              <div key={group.category}>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                  {group.category}
                </h3>
                <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 dark:border-zinc-800">
                  {group.items.map((link) => (
                    <li
                      key={link.id}
                      className={`flex items-start justify-between gap-4 px-4 py-4 transition-colors hover:bg-neutral-50 dark:bg-zinc-950/80 ${
                        editingId === link.id ? 'bg-brand-tint/50' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-neutral-900 dark:text-gray-100">{link.title}</p>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-primary hover:opacity-90"
                            aria-label={`Abrir ${link.title}`}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-neutral-400">{link.url}</p>
                        <p className="mt-1 text-sm text-neutral-600 dark:text-gray-400">{link.description}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(link)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-gray-300 transition-colors hover:border-brand-primary/25 dark:border-brand-primary/40 hover:bg-brand-tint hover:text-brand-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => link.id && handleDelete(link.id, link.title)}
                          disabled={deletingId === link.id}
                          aria-label={`Eliminar ${link.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-danger transition-colors hover:bg-brand-tint disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
