import { HardDrive } from 'lucide-react'
import { PublicResourceExplorer } from '../components/PublicResourceExplorer'

export function Resources() {
  return (
    <div className="w-full space-y-8">
      <header className="border-b border-neutral-200 dark:border-zinc-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-gray-100">
              Recursos compartidos
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
              Documentos, formularios y enlaces de la empresa
            </p>
          </div>
        </div>
      </header>

      <PublicResourceExplorer />
    </div>
  )
}
