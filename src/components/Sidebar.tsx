import {
  BookUser,
  CalendarClock,
  FileText,
  FolderOpen,
  Home,
  LayoutDashboard,
  Settings,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-brand-primary text-white'
      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-gray-100'
  }`

const NAV_ITEMS: {
  to: string
  end?: boolean
  label: string
  icon: typeof LayoutDashboard
}[] = [
  { to: '/intranet', label: 'Intranet', icon: Home },
  { to: '/admin', end: true, label: 'Dashboard', icon: LayoutDashboard },
  { to: '/admin/content', label: 'Contenido', icon: FileText },
  { to: '/admin/directory', label: 'Contactos', icon: BookUser },
  { to: '/admin/shifts', label: 'Turnos', icon: CalendarClock },
  { to: '/admin/resources', label: 'Enlaces y recursos', icon: FolderOpen },
  { to: '/admin/users', label: 'Configuración y usuarios', icon: Settings },
]

export function Sidebar() {
  const { user, logout } = useAuth()

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-neutral-200 px-6 py-5 dark:border-zinc-800">
        <p className="text-lg font-semibold text-neutral-900 dark:text-gray-100">Panel Admin</p>
        <p className="mt-1 truncate text-xs text-neutral-500 dark:text-gray-400">{user?.email}</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-4">
        {NAV_ITEMS.map(({ to, end, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClass}>
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-neutral-200 p-4 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => logout()}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-400 hover:bg-white dark:border-zinc-700 dark:text-gray-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
