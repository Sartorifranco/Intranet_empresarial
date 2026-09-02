import { Timestamp } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { getNews, type NewsCategory, type NewsPost } from '../services/newsService'

const NEWS_CATEGORY_STYLES: Record<NewsCategory, { label: string; badge: string }> = {
  General: {
    label: 'General',
    badge: 'bg-neutral-100 dark:bg-zinc-800 text-neutral-700 dark:text-gray-300 ring-neutral-200',
  },
  'Recursos Humanos': {
    label: 'RRHH',
    badge: 'bg-neutral-100 dark:bg-zinc-800 text-neutral-700 dark:text-gray-300 ring-neutral-200',
  },
  Sistemas: {
    label: 'Sistemas',
    badge: 'bg-brand-tint text-brand-primary ring-brand-primary/15',
  },
}

function formatDate(date: Timestamp | Date) {
  const value = date instanceof Timestamp ? date.toDate() : date
  const month = value.toLocaleDateString('es-AR', { month: 'long' })
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1)

  return `${value.getDate()} de ${capitalizedMonth}, ${value.getFullYear()}`
}

function NewsSkeleton({ editorial = false }: { editorial?: boolean }) {
  if (editorial) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-neutral-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <div className="aspect-[21/9] bg-neutral-100 dark:bg-zinc-800" />
            <div className="space-y-3 p-6">
              <div className="h-4 w-24 rounded-full bg-neutral-100 dark:bg-zinc-800" />
              <div className="h-7 w-3/4 rounded bg-neutral-100 dark:bg-zinc-800" />
              <div className="h-3 w-40 rounded bg-neutral-100 dark:bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-lg bg-neutral-50 dark:bg-zinc-950">
          <div className="h-40 bg-neutral-200" />
          <div className="space-y-3 p-6">
            <div className="h-5 w-20 rounded-full bg-neutral-200" />
            <div className="h-6 w-4/5 rounded bg-neutral-200" />
            <div className="h-3 w-32 rounded bg-neutral-100 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function NewsFeed({ variant = 'grid' }: { variant?: 'grid' | 'editorial' }) {
  const [news, setNews] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const editorial = variant === 'editorial'

  useEffect(() => {
    getNews()
      .then((data) => {
        setNews(data)
        setError(null)
      })
      .catch((err) => {
        console.error('Error al cargar las noticias:', err)
        setNews([])
        setError('No se pudieron cargar las noticias.')
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <section id="comunicados" className="min-w-0 scroll-mt-24">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-gray-100">Comunicados</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            Novedades internas publicadas por el equipo administrativo
          </p>
        </div>
        {!loading && news.length > 0 && (
          <span className="shrink-0 text-sm text-neutral-400">
            {news.length} {news.length === 1 ? 'publicación' : 'publicaciones'}
          </span>
        )}
      </div>

      {loading ? (
        <NewsSkeleton editorial={editorial} />
      ) : error ? (
        <div className="rounded-lg bg-brand-tint px-6 py-12 text-center">
          <p className="text-sm font-medium text-danger">{error}</p>
        </div>
      ) : news.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 px-6 py-16 text-center">
          <p className="text-sm font-medium text-neutral-600 dark:text-gray-400">
            Aún no hay noticias publicadas.
          </p>
        </div>
      ) : (
        <div className={editorial ? 'space-y-6' : 'grid gap-5 sm:grid-cols-2'}>
          {news.map((post) => {
            const category = NEWS_CATEGORY_STYLES[post.category]

            return (
              <article
                key={post.id}
                className={`overflow-hidden bg-white dark:bg-zinc-900 ${
                  editorial
                    ? 'rounded-xl border border-neutral-200 dark:border-zinc-800'
                    : 'card-minimal flex flex-col'
                }`}
              >
                {post.imageUrl && (
                  <div
                    className={`relative w-full overflow-hidden bg-neutral-100 dark:bg-zinc-800 ${
                      editorial ? 'aspect-[16/9] sm:aspect-[21/9]' : 'aspect-[16/9]'
                    }`}
                  >
                    <img
                      src={post.imageUrl}
                      alt={post.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                )}

                <div className={`flex min-w-0 flex-1 flex-col ${editorial ? 'p-4 lg:p-6 xl:p-8' : 'p-4 lg:p-6'}`}>
                  <span
                    className={`mb-3 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset sm:mb-4 ${category.badge}`}
                  >
                    {category.label}
                  </span>

                  <h3
                    className={`font-bold leading-snug text-neutral-900 dark:text-gray-100 ${
                      editorial
                        ? 'mb-2 line-clamp-2 text-xl tracking-tight sm:mb-3 sm:text-2xl'
                        : 'mb-2 line-clamp-2 text-lg'
                    }`}
                  >
                    {post.title}
                  </h3>

                  <time
                    dateTime={
                      post.createdAt instanceof Timestamp
                        ? post.createdAt.toDate().toISOString()
                        : post.createdAt.toISOString()
                    }
                    className={`block text-sm text-neutral-400 ${editorial ? 'mb-4 sm:mb-5' : 'mb-4'}`}
                  >
                    {formatDate(post.createdAt)}
                  </time>

                  <p
                    className={`flex-1 leading-relaxed text-neutral-600 dark:text-gray-400 ${
                      editorial ? 'line-clamp-3 text-sm sm:text-base' : 'line-clamp-3 text-sm'
                    }`}
                  >
                    {post.content}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
