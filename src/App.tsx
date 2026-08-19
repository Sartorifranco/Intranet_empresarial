import { Toaster } from 'react-hot-toast'
import { AppProvider, AuthProvider, ThemeProvider } from './context'
import { GlobalSettingsProvider } from './context/GlobalSettingsContext'
import { AppRoutes } from './routes'

function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AuthProvider>
          <GlobalSettingsProvider>
            <AppRoutes />
            <Toaster
              position="top-right"
              toastOptions={{
                className: 'dark:!bg-zinc-900 dark:!text-gray-100 dark:!border-zinc-700',
              }}
            />
          </GlobalSettingsProvider>
        </AuthProvider>
      </AppProvider>
    </ThemeProvider>
  )
}

export default App
