import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  DEFAULT_GLOBAL_SETTINGS,
  subscribeGlobalSettings,
  type GlobalSettings,
} from '../services/configService'
import { useAuth } from './AuthContext'

interface GlobalSettingsContextValue {
  settings: GlobalSettings
  loading: boolean
  permissionDenied: boolean
}

const GlobalSettingsContext = createContext<GlobalSettingsContextValue | null>(null)

export function GlobalSettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [settings, setSettings] = useState<GlobalSettings>(DEFAULT_GLOBAL_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [permissionDenied, setPermissionDenied] = useState(false)

  useEffect(() => {
    if (!user) {
      setSettings(DEFAULT_GLOBAL_SETTINGS)
      setPermissionDenied(false)
      setLoading(false)
      return
    }

    setLoading(true)

    const unsubscribe = subscribeGlobalSettings(
      (nextSettings) => {
        setSettings(nextSettings)
        setPermissionDenied(false)
        setLoading(false)
      },
      (error) => {
        const code = (error as { code?: string }).code
        if (code === 'permission-denied') {
          setPermissionDenied(true)
        }
        setLoading(false)
      },
    )

    return unsubscribe
  }, [user])

  return (
    <GlobalSettingsContext.Provider value={{ settings, loading, permissionDenied }}>
      {children}
    </GlobalSettingsContext.Provider>
  )
}

export function useGlobalSettings() {
  const context = useContext(GlobalSettingsContext)
  if (!context) {
    throw new Error('useGlobalSettings debe usarse dentro de GlobalSettingsProvider')
  }
  return context
}
