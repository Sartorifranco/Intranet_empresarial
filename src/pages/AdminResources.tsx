import { ResourceExplorer } from '../components/ResourceExplorer'

export function AdminResources() {
  return (
    <div className="w-full space-y-2">
      <header className="mb-6">
        <p className="text-brand-primary mb-1 text-sm font-medium uppercase tracking-wide">
          Gestión
        </p>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-gray-100">Enlaces y recursos</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
          Organizá carpetas, enlaces y archivos compartidos con permisos por nivel
        </p>
      </header>

      <ResourceExplorer />
    </div>
  )
}
