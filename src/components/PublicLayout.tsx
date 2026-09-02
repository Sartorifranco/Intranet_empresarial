import { Outlet } from 'react-router-dom'
import { Navbar } from './Navbar'

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-white text-brand-body dark:bg-zinc-950">
      <Navbar />
      <main className="layout-container">
        <Outlet />
      </main>
    </div>
  )
}
