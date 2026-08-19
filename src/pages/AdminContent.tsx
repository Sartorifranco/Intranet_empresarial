import { useState } from 'react'
import { AdminTabs } from '../components/AdminTabs'
import { BannerManager } from '../components/BannerManager'
import { NewsManager } from '../components/NewsManager'
import { PollManager } from '../components/PollManager'
import { DailyQuestionManager } from '../components/DailyQuestionManager'

const TABS = [
  { id: 'news', label: 'Noticias' },
  { id: 'banners', label: 'Banners / Popups' },
  { id: 'polls', label: 'Encuestas' },
  { id: 'daily', label: 'Pregunta del día' },
] as const

type ContentTab = (typeof TABS)[number]['id']

export function AdminContent() {
  const [activeTab, setActiveTab] = useState<ContentTab>('news')

  return (
    <div className="w-full space-y-2">
      <header className="mb-6">
        <p className="text-brand-primary mb-1 text-sm font-medium uppercase tracking-wide">
          Gestión
        </p>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-gray-100">Contenido</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-gray-400">
          Noticias, avisos destacados y encuestas de la intranet
        </p>
      </header>

      <AdminTabs tabs={[...TABS]} activeTab={activeTab} onChange={(id) => setActiveTab(id as ContentTab)} />

      {activeTab === 'news' && <NewsManager />}
      {activeTab === 'banners' && <BannerManager />}
      {activeTab === 'polls' && <PollManager />}
      {activeTab === 'daily' && <DailyQuestionManager />}
    </div>
  )
}
