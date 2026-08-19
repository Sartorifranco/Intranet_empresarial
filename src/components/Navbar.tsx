import { FileText, LayoutGrid, Link2, LogOut, Moon, Newspaper, Search, Sun, X } from 'lucide-react'
import { signOut } from 'firebase/auth'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth, useTheme } from '../context'
import { useGlobalSettings } from '../context/GlobalSettingsContext'
import { NavbarUtilities } from './NavbarUtilities'
import { auth } from '../services/firebase'
import { DEFAULT_PERMISSIONS, isSuperAdminEmail } from '../services/userService'
import { getLinks, type UsefulLink } from '../services/linkService'
import { getNews, type NewsPost } from '../services/newsService'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'nav-link-active'
      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100'
  }`

interface SearchResult {
  id: string
  type: 'news' | 'link'
  title: string
  subtitle: string
  url: string
  external?: boolean
}

export function Navbar() {
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const { settings } = useGlobalSettings()
  const permissions = userProfile?.permissions ?? DEFAULT_PERMISSIONS
  const canAccessAdmin = isSuperAdminEmail(user?.email)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [news, setNews] = useState<NewsPost[]>([])
  const [links, setLinks] = useState<UsefulLink[]>([])
  const [dataLoaded, setDataLoaded] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getNews(), getLinks()])
      .then(([newsData, linksData]) => {
        setNews(newsData)
        setLinks(linksData)
      })
      .catch((err) => console.error('Error al cargar datos del buscador:', err))
      .finally(() => setDataLoaded(true))
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const results = useMemo<SearchResult[]>(() => {
    if (query.trim().length <= 2) return []

    const term = query.trim().toLowerCase()

    const newsResults: SearchResult[] = news
      .filter(
        (item) =>
          item.title.toLowerCase().includes(term) ||
          item.content.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term),
      )
      .slice(0, 5)
      .map((item) => ({
        id: `news-${item.id}`,
        type: 'news' as const,
        title: item.title,
        subtitle: item.category,
        url: '/intranet#comunicados',
      }))

    const linkResults: SearchResult[] = links
      .filter(
        (item) =>
          item.title.toLowerCase().includes(term) ||
          item.description.toLowerCase().includes(term) ||
          item.category.toLowerCase().includes(term),
      )
      .slice(0, 5)
      .map((item) => ({
        id: `link-${item.id}`,
        type: 'link' as const,
        title: item.title,
        subtitle: item.category,
        url: item.url,
        external: true,
      }))

    return [...newsResults, ...linkResults]
  }, [query, news, links])

  const handleSelect = (result: SearchResult) => {
    setQuery('')
    setOpen(false)

    if (result.external) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
    } else {
      navigate(result.url)
    }
  }

  const handleLogout = async () => {
    await signOut(auth)
    navigate('/')
  }

  const showDropdown = open && query.trim().length > 2

  return (
    <header
      className="border-b shadow-sm"
      style={{
        backgroundColor: 'var(--color-navbar-bg)',
        borderColor: 'var(--color-navbar-border)',
      }}
    >
      <div className="layout-container flex flex-wrap items-center gap-4 !py-4">
        <Link to="/intranet" className="flex shrink-0 items-center gap-3">
          <img
            src="/logo-bacar.png"
            alt="Logo Bacar"
            className="h-9 w-9 object-contain"
          />
          <div>
            <p className="text-lg font-semibold text-neutral-900 dark:text-gray-100">Intranet Bacar</p>
            <p className="text-xs text-neutral-500 dark:text-gray-400">Portal institucional</p>
          </div>
        </Link>

        <div ref={searchRef} className="relative order-last w-full md:order-none md:mx-4 md:max-w-sm md:flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar comunicados y enlaces..."
            className="input-brand-focus w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pr-9 pl-9 text-sm text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:bg-zinc-900"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setOpen(false)
              }}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-800 dark:hover:text-gray-300"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}

          {showDropdown && (
            <div className="absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
              {!dataLoaded ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Buscando...</p>
              ) : results.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                  No se encontraron resultados para &ldquo;{query.trim()}&rdquo;
                </p>
              ) : (
                <ul className="max-h-80 overflow-y-auto py-2">
                  {results.map((result) => (
                    <li key={result.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(result)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                            result.type === 'news'
                              ? 'bg-brand-primary-light text-brand-primary'
                              : 'bg-emerald-50 text-emerald-600'
                          }`}
                        >
                          {result.type === 'news' ? (
                            <Newspaper className="h-4 w-4" />
                          ) : (
                            <Link2 className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {result.title}
                          </p>
                          <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                            {result.type === 'news' ? 'Comunicado' : 'Enlace'} ·{' '}
                            {result.subtitle}
                          </p>
                        </div>
                        {result.external && (
                          <FileText className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-300" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          <NavLink to="/intranet" end className={navLinkClass}>
            Inicio
          </NavLink>
          <NavLink to="/accesos-directos" className={navLinkClass}>
            <span className="inline-flex items-center gap-1.5">
              <LayoutGrid className="h-4 w-4" />
              Accesos directos
            </span>
          </NavLink>
          {settings.directoryEnabled && permissions.view_directory && (
            <NavLink to="/directorio" className={navLinkClass}>
              Contactos
            </NavLink>
          )}
          {settings.resourcesEnabled && permissions.view_drive && (
            <NavLink to="/recursos" className={navLinkClass}>
              Recursos
            </NavLink>
          )}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <NavbarUtilities />

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Activar modo claro' : 'Activar modo oscuro'}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:border-zinc-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-zinc-600 transition-colors hover:text-red-900 dark:text-zinc-400 dark:hover:text-red-500 md:px-3"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Salir</span>
          </button>

          {canAccessAdmin && (
            <Link to="/admin" className="btn-primary rounded-lg px-4 py-2 text-sm font-medium">
              Panel admin
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
