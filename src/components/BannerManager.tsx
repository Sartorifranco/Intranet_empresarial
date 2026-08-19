import { Timestamp } from 'firebase/firestore'
import { ImageIcon, Megaphone, Trash2 } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  createBanner,
  deleteBanner,
  getBanners,
  setBannerActive,
  updateBanner,
  type Banner,
} from '../services/bannerService'

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

export function BannerManager() {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [title, setTitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [active, setActive] = useState(false)

  const loadBanners = useCallback(async () => {
    try {
      const data = await getBanners()
      setBanners(data)
      setError(null)
    } catch (err) {
      console.error('Error al cargar banners:', err)
      setBanners([])
      setError('No se pudieron cargar los banners.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBanners()
  }, [loadBanners])

  const resetForm = () => {
    setTitle('')
    setImageUrl('')
    setActive(false)
    setEditingId(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const payload = {
      title: title.trim(),
      imageUrl: imageUrl.trim(),
      active,
    }

    try {
      if (editingId) {
        await updateBanner(editingId, payload)
        toast.success('Banner actualizado')
      } else {
        await createBanner(payload)
        toast.success('Banner creado')
      }

      resetForm()
      await loadBanners()
    } catch (err) {
      console.error('Error al guardar banner:', err)
      toast.error('Error al guardar el banner')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (banner: Banner) => {
    setEditingId(banner.id ?? null)
    setTitle(banner.title)
    setImageUrl(banner.imageUrl)
    setActive(banner.active)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleToggleActive = async (banner: Banner) => {
    if (!banner.id) return

    setTogglingId(banner.id)

    try {
      await setBannerActive(banner.id, !banner.active)
      toast.success(banner.active ? 'Banner desactivado' : 'Banner activado')
      await loadBanners()
    } catch (err) {
      console.error('Error al cambiar estado del banner:', err)
      toast.error('No se pudo cambiar el estado')
    } finally {
      setTogglingId(null)
    }
  }

  const handleDelete = async (id: string, bannerTitle: string) => {
    const confirmed = window.confirm(
      `¿Eliminar el banner "${bannerTitle}"? Esta acción no se puede deshacer.`,
    )
    if (!confirmed) return

    setDeletingId(id)

    try {
      await deleteBanner(id)
      toast.success('Banner eliminado')
      if (editingId === id) resetForm()
      await loadBanners()
    } catch (err) {
      console.error('Error al eliminar banner:', err)
      toast.error('Error al eliminar el banner')
    } finally {
      setDeletingId(null)
    }
  }

  const activeBanner = banners.find((b) => b.active)

  return (
    <div className="space-y-8">
      <section className="card-minimal overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary text-white">
              <Megaphone className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">
                {editingId ? 'Editar banner' : 'Nuevo banner / popup'}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-gray-400">
                Solo puede haber un banner activo a la vez en la intranet
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="grid gap-5 lg:grid-cols-2">
            <div>
              <label htmlFor="banner-title" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
                Título
              </label>
              <input
                id="banner-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Aviso importante de RRHH"
                className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="banner-image" className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-gray-300">
                URL de imagen o GIF
              </label>
              <input
                id="banner-image"
                type="url"
                required
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://ejemplo.com/imagen.gif"
                className="input-brand-focus w-full rounded-lg border border-neutral-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-sm"
              />
            </div>
          </div>

          {imageUrl && (
            <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 p-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500 dark:text-gray-400">
                Vista previa
              </p>
              <img
                src={imageUrl}
                alt="Vista previa"
                className="mx-auto max-h-48 rounded object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
          )}

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 dark:border-zinc-700 text-brand-primary focus:ring-red-900/20"
            />
            <span className="text-sm text-neutral-700 dark:text-gray-300">
              Activar este banner al guardar
              {active && activeBanner && activeBanner.id !== editingId && (
                <span className="ml-1 text-neutral-500 dark:text-gray-400">
                  (desactivará el banner actual)
                </span>
              )}
            </span>
          </label>

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
              {submitting ? 'Guardando...' : editingId ? 'Actualizar' : 'Crear banner'}
            </button>
          </div>
        </form>
      </section>

      <section className="card-minimal overflow-hidden">
        <div className="border-b border-neutral-200 dark:border-zinc-800 px-6 py-5">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-gray-100">Banners registrados</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            {banners.length} {banners.length === 1 ? 'banner' : 'banners'} en total
            {activeBanner && (
              <span className="text-brand-primary">
                {' '}
                · Activo: {activeBanner.title}
              </span>
            )}
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner-brand h-8 w-8 animate-spin rounded-full border-4" />
          </div>
        ) : error ? (
          <p className="px-6 py-16 text-center text-sm text-red-600">{error}</p>
        ) : banners.length === 0 ? (
          <p className="px-6 py-16 text-center text-sm text-neutral-500 dark:text-gray-400">
            Aún no hay banners creados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-gray-400">
                  <th className="px-6 py-3">Banner</th>
                  <th className="px-6 py-3">Estado</th>
                  <th className="px-6 py-3">Fecha</th>
                  <th className="px-6 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {banners.map((banner) => (
                  <tr key={banner.id} className="transition-colors hover:bg-neutral-50 dark:bg-zinc-950/80">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-neutral-200 dark:border-zinc-800 bg-neutral-100 dark:bg-zinc-800">
                          {banner.imageUrl ? (
                            <img
                              src={banner.imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon className="h-4 w-4 text-neutral-400" />
                          )}
                        </div>
                        <span className="font-medium text-neutral-900 dark:text-gray-100">{banner.title}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(banner)}
                        disabled={togglingId === banner.id}
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                          banner.active
                            ? 'bg-red-50 dark:bg-red-950/40 text-brand-primary ring-1 ring-red-100'
                            : 'bg-neutral-100 dark:bg-zinc-800 text-neutral-600 dark:text-gray-400 hover:bg-neutral-200'
                        }`}
                      >
                        {togglingId === banner.id
                          ? '...'
                          : banner.active
                            ? 'Activo'
                            : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-neutral-500 dark:text-gray-400">
                      {formatDate(banner.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(banner)}
                          className="rounded-lg border border-neutral-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-gray-300 hover:bg-neutral-50 dark:bg-zinc-950"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => banner.id && handleDelete(banner.id, banner.title)}
                          disabled={deletingId === banner.id}
                          aria-label={`Eliminar ${banner.title}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 dark:bg-red-950/40 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
