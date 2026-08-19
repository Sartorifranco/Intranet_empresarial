import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function AdminLayout() {
  return (
    <div className="flex min-h-screen bg-white dark:bg-zinc-950">
      <Sidebar />
      <main className="flex-1 overflow-auto bg-white px-6 py-8 dark:bg-zinc-950 lg:px-10 xl:px-12">
        <Outlet />
      </main>
    </div>
  )
}
