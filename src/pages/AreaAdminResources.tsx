import { ResourceExplorer } from '../components/ResourceExplorer'

export function AreaAdminResources() {
  return (
    <div className="w-full space-y-2">
      <header className="mb-6">
        <p className="text-brand-primary mb-1 text-sm font-medium uppercase tracking-wide">
          Administración de área
        </p>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-gray-100">Mis áreas</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
          Gestioná carpetas y permisos dentro de las áreas que administrás
        </p>
      </header>

      <ResourceExplorer mode="areaAdmin" />
    </div>
  )
}
