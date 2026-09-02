import { Timestamp } from 'firebase/firestore'
import { ExternalLink } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { BirthdayWidget } from '../components/BirthdayWidget'
import { DailyWidgets } from '../components/DailyWidgets'
import { KudosWall } from '../components/KudosWall'
import { PollWidget } from '../components/PollWidget'
import { getLinks, type LinkCategory, type UsefulLink } from '../services/linkService'
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

const LINK_CATEGORY_STYLES: Record<
  LinkCategory,
  { accent: string; icon: string; border: string }
> = {
  'Herramientas IT': {
    accent: 'text-brand-primary',
    icon: 'bg-brand-tint text-brand-primary',
    border: 'hover:border-brand-primary/25 dark:border-brand-primary/40 ',
  },
  Operaciones: {
    accent: 'text-neutral-700 dark:text-gray-300',
    icon: 'bg-neutral-100 dark:bg-zinc-800 text-neutral-700 dark:text-gray-300',
    border: 'hover:border-neutral-300 dark:border-zinc-700 hover:shadow-neutral-100',
  },
  RRHH: {
    accent: 'text-neutral-700 dark:text-gray-300',
    icon: 'bg-neutral-100 dark:bg-zinc-800 text-neutral-700 dark:text-gray-300',
    border: 'hover:border-neutral-300 dark:border-zinc-700 hover:shadow-neutral-100',
  },
}

const LINK_CATEGORIES: LinkCategory[] = ['Herramientas IT', 'Operaciones', 'RRHH']

function formatDate(date: Timestamp | Date) {
  const value = date instanceof Timestamp ? date.toDate() : date
  const month = value.toLocaleDateString('es-AR', { month: 'long' })
  const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1)

  return `${value.getDate()} de ${capitalizedMonth}, ${value.getFullYear()}`
}

function NewsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg bg-neutral-50 dark:bg-zinc-950 p-6">
          <div className="mb-4 h-5 w-20 rounded-full bg-neutral-200" />
          <div className="mb-3 h-6 w-4/5 rounded-lg bg-neutral-200" />
          <div className="mb-5 h-3 w-32 rounded bg-neutral-100 dark:bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-neutral-100 dark:bg-zinc-800" />
            <div className="h-3 w-full rounded bg-neutral-100 dark:bg-zinc-800" />
            <div className="h-3 w-2/3 rounded bg-neutral-100 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

function LinksSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg bg-neutral-50 dark:bg-zinc-950 p-4">
          <div className="mb-3 h-3 w-24 rounded bg-neutral-200" />
          <div className="space-y-2">
            <div className="h-12 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
            <div className="h-12 rounded-lg bg-neutral-100 dark:bg-zinc-800" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Intranet() {
  const [news, setNews] = useState<NewsPost[]>([])
  const [links, setLinks] = useState<UsefulLink[]>([])
  const [loadingNews, setLoadingNews] = useState(true)
  const [loadingLinks, setLoadingLinks] = useState(true)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [linksError, setLinksError] = useState<string | null>(null)

  useEffect(() => {
    getNews()
      .then((data) => {
        setNews(data)
        setNewsError(null)
      })
      .catch((err) => {
        console.error('Error al cargar las noticias:', err)
        setNews([])
        setNewsError('No se pudieron cargar las noticias. Intentá nuevamente.')
      })
      .finally(() => setLoadingNews(false))

    getLinks()
      .then((data) => {
        setLinks(data)
        setLinksError(null)
      })
      .catch((err) => {
        console.error('Error al cargar los enlaces:', err)
        setLinks([])
        setLinksError('No se pudieron cargar los accesos directos.')
      })
      .finally(() => setLoadingLinks(false))
  }, [])

  const linksByCategory = useMemo(
    () =>
      LINK_CATEGORIES.map((category) => ({
        category,
        items: links.filter((link) => link.category === category),
      })).filter((group) => group.items.length > 0),
    [links],
  )

  return (
    <div className="space-y-8">
      <section className="hero-gradient card-minimal p-8">
        <p className="text-brand-primary mb-2 text-sm font-semibold uppercase tracking-wide">
          Bienvenido
        </p>
        <h1 className="mb-3 text-3xl font-bold text-neutral-900 dark:text-gray-100">
          Intranet Institucional
        </h1>
        <p className="max-w-2xl text-neutral-600 dark:text-gray-400">
          Portal de acceso para todos los empleados. Consultá los últimos
          comunicados y accedé a los sistemas de la empresa.
        </p>
      </section>

      <DailyWidgets />

      <KudosWall />

      <div className="grid gap-8 lg:grid-cols-3">
        <section id="comunicados" className="lg:col-span-2 scroll-mt-24">
          <div className="mb-5 flex items-end justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Comunicados</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Novedades internas publicadas por el equipo administrativo
              </p>
            </div>
            {!loadingNews && news.length > 0 && (
              <span className="text-sm text-gray-400">
                {news.length} {news.length === 1 ? 'publicación' : 'publicaciones'}
              </span>
            )}
          </div>

          {loadingNews ? (
            <NewsSkeleton />
          ) : newsError ? (
            <div className="rounded-lg bg-brand-tint px-6 py-12 text-center">
              <p className="text-sm font-medium text-danger">{newsError}</p>
            </div>
          ) : news.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 px-6 py-16 text-center">
              <p className="text-sm font-medium text-neutral-600 dark:text-gray-400">
                Aún no hay noticias publicadas.
              </p>
              <p className="mt-1 text-sm text-neutral-400">
                Volvé pronto para ver las novedades de la empresa.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              {news.map((post) => {
                const category = NEWS_CATEGORY_STYLES[post.category]

                return (
                  <article
                    key={post.id}
                    className="card-minimal flex flex-col overflow-hidden transition-shadow hover:shadow-sm"
                  >
                    {post.imageUrl && (
                      <div className="relative aspect-[16/9] w-full overflow-hidden bg-neutral-100 dark:bg-zinc-800">
                        <img
                          src={post.imageUrl}
                          alt={post.title}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-6">
                    <span
                      className={`mb-4 inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${category.badge}`}
                    >
                      {category.label}
                    </span>

                    <h3 className="mb-2 text-lg font-bold leading-snug text-gray-900 dark:text-gray-100">
                      {post.title}
                    </h3>

                    <time
                      dateTime={
                        post.createdAt instanceof Timestamp
                          ? post.createdAt.toDate().toISOString()
                          : post.createdAt.toISOString()
                      }
                      className="mb-4 block text-sm text-gray-400"
                    >
                      {formatDate(post.createdAt)}
                    </time>

                    <p className="flex-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                      {post.content}
                    </p>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="space-y-6 lg:col-span-1">
          <PollWidget />
          <BirthdayWidget />

          <div className="card-minimal sticky top-6 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Accesos directos</h2>
            <p className="mt-1 mb-5 text-sm text-gray-500 dark:text-gray-400">
              Sistemas y herramientas de la empresa
            </p>

            {loadingLinks ? (
              <LinksSkeleton />
            ) : linksError ? (
              <p className="rounded-lg bg-brand-tint px-4 py-3 text-sm text-danger">{linksError}</p>
            ) : links.length === 0 ? (
              <p className="rounded-lg border border-dashed border-neutral-200 dark:border-zinc-800 px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Aún no hay enlaces disponibles.
              </p>
            ) : (
              <div className="space-y-6">
                {linksByCategory.map((group) => {
                  const styles = LINK_CATEGORY_STYLES[group.category]

                  return (
                    <div key={group.category}>
                      <h3
                        className={`mb-3 text-xs font-semibold uppercase tracking-wide ${styles.accent}`}
                      >
                        {group.category}
                      </h3>
                      <div className="space-y-2">
                        {group.items.map((link) => (
                          <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`group flex items-start gap-3 rounded-lg border border-neutral-100 dark:border-zinc-800 bg-neutral-50 dark:bg-zinc-950 p-4 transition-all hover:bg-white dark:bg-zinc-900 hover:shadow-sm ${styles.border}`}
                          >
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${styles.icon}`}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-gray-900 dark:text-gray-100 group-hover:underline">
                                {link.title}
                              </p>
                              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                                {link.description}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
