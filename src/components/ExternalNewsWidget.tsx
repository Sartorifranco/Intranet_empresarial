import { ChevronLeft, ChevronRight, Newspaper } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchExternalHeadlines,
  formatRelativeDate,
  type ExternalArticle,
} from '../services/externalNewsService'

function LiveIndicator() {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden="true">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-600 opacity-50" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-700 animate-pulse dark:bg-red-500" />
    </span>
  )
}

function EditorialSkeleton() {
  return (
    <div
      className="scrollbar-hide flex w-full gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-56 w-[300px] shrink-0 snap-start animate-pulse rounded-2xl bg-neutral-200 dark:bg-zinc-800"
        />
      ))}
    </div>
  )
}

function EditorialCard({ article }: { article: ExternalArticle }) {
  const relativeDate = formatRelativeDate(article.publishedAt)

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative block h-56 w-[300px] shrink-0 snap-start overflow-hidden rounded-2xl border border-neutral-200/80 shadow-md transition-shadow hover:shadow-xl dark:border-zinc-700/80"
    >
      {article.imageUrl ? (
        <img
          src={article.imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 via-neutral-900 to-black">
          <div className="flex h-full items-center justify-center opacity-20">
            <Newspaper className="h-16 w-16 text-white" strokeWidth={1.25} />
          </div>
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />

      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
        {relativeDate && (
          <time
            dateTime={article.publishedAt}
            className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/70"
          >
            {relativeDate}
          </time>
        )}
        <h3 className="line-clamp-3 text-base font-bold leading-snug text-white sm:text-[1.05rem]">
          {article.title}
        </h3>
      </div>
    </a>
  )
}

export function ExternalNewsWidget() {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [articles, setArticles] = useState<ExternalArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      })
    }
  }

  const loadHeadlines = useCallback(async (signal?: AbortSignal) => {
    setError(false)

    try {
      const data = await fetchExternalHeadlines(signal)
      setArticles(data)
      if (data.length === 0) setError(true)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('Error al cargar noticias externas:', err)
      setArticles([])
      setError(true)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    loadHeadlines(controller.signal).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })

    const interval = window.setInterval(() => {
      loadHeadlines()
    }, 15 * 60 * 1000)

    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [loadHeadlines])

  if (!loading && error && articles.length === 0) {
    return null
  }

  return (
    <section
      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      aria-label="Banda editorial de noticias de Argentina"
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-100 px-4 py-4 dark:border-zinc-800 sm:px-6 sm:py-5">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <LiveIndicator />
            <p className="text-brand-primary text-xs font-semibold uppercase tracking-widest">
              Argentina
            </p>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-white">
            Últimas Noticias
          </h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
            Titulares del día · selección editorial
          </p>
        </div>
        {!loading && articles.length > 1 && (
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => scroll('left')}
              aria-label="Desplazar noticias hacia la izquierda"
              className="rounded-full bg-zinc-100 p-2 text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => scroll('right')}
              aria-label="Desplazar noticias hacia la derecha"
              className="rounded-full bg-zinc-100 p-2 text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>

      <div className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
        {loading ? (
          <EditorialSkeleton />
        ) : error ? (
          <p className="text-sm text-neutral-400 dark:text-gray-500">
            No se pudieron cargar los titulares.
          </p>
        ) : (
          <div
            ref={scrollContainerRef}
            className="scrollbar-hide flex w-full gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth"
          >
            {articles.map((article) => (
              <EditorialCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
