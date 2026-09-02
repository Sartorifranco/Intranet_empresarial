import { useEffect, useMemo, useState } from 'react'
import { resolveHomeWidgetPreferences } from '../../constants/homeWidgets'
import {
  fetchCordobaWeather,
  type WeatherSnapshot,
} from '../../services/dailyUtilityService'
import type { UserProfile } from '../../services/userService'
import { HomeDollarWidget } from './HomeDollarWidget'
import { HomeWidgetSettingsMenu } from './HomeWidgetSettingsMenu'
import { getWeatherAmbientStyle } from './weatherAmbient'
import { WeatherAmbientIllustration } from './WeatherAmbientIllustration'
import { getWeatherInlineIconTone, WeatherIconGlyph } from '../weather/weatherIcons'

const WEATHER_REFRESH_MS = 60_000

interface WelcomeHeaderProps {
  userProfile: UserProfile
  displayName: string
  onPreferencesUpdated: () => void | Promise<void>
}

export function WelcomeHeader({
  userProfile,
  displayName,
  onPreferencesUpdated,
}: WelcomeHeaderProps) {
  const [preferences, setPreferences] = useState(() =>
    resolveHomeWidgetPreferences(userProfile.widgetPreferences),
  )
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)

  useEffect(() => {
    setPreferences(resolveHomeWidgetPreferences(userProfile.widgetPreferences))
  }, [userProfile.widgetPreferences])

  const showWeather = preferences.weather
  const showDollar = preferences.dollar

  useEffect(() => {
    if (!showWeather) {
      setWeather(null)
      return
    }

    let cancelled = false
    let controller: AbortController | null = null

    const load = async () => {
      controller?.abort()
      controller = new AbortController()

      try {
        const value = await fetchCordobaWeather(controller.signal)
        if (!cancelled) setWeather(value)
      } catch {
        if (!cancelled) setWeather(null)
      }
    }

    void load()
    const intervalId = window.setInterval(() => {
      void load()
    }, WEATHER_REFRESH_MS)

    return () => {
      cancelled = true
      controller?.abort()
      window.clearInterval(intervalId)
    }
  }, [showWeather])

  const ambientStyle = useMemo(() => {
    if (!showWeather || !weather) return null
    return getWeatherAmbientStyle(weather.icon)
  }, [showWeather, weather])

  const handlePreferencesUpdated = (next: typeof preferences) => {
    setPreferences(next)
    void onPreferencesUpdated()
  }

  return (
    <header className="relative overflow-visible rounded-xl border border-neutral-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {ambientStyle && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-xl dark:hidden"
            style={{ background: ambientStyle.light }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 hidden rounded-xl dark:block"
            style={{ background: ambientStyle.dark }}
          />
        </>
      )}

      {showWeather && weather && <WeatherAmbientIllustration icon={weather.icon} />}

      <div className="relative z-10 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-brand-primary">
              BacarNet
            </p>
            <h1 className="break-words text-2xl font-bold tracking-tight text-neutral-900 dark:text-gray-100 sm:text-3xl">
              ¡Hola, {displayName}!
            </h1>
            <p className="mt-2 max-w-xl text-sm text-neutral-600 dark:text-gray-400">
              Encontrá tus herramientas, accesos e información en un solo lugar.
            </p>
          </div>

          <div className="flex w-full shrink-0 flex-wrap items-center justify-end gap-2 sm:gap-3 lg:max-w-md lg:pt-0.5">
            <HomeWidgetSettingsMenu
              userId={userProfile.uid}
              preferences={preferences}
              onUpdated={handlePreferencesUpdated}
            />

            {showWeather && (
              <div
                className="relative z-10 flex min-w-[6.5rem] items-center gap-2 px-1 sm:min-w-[7.5rem]"
                title={weather ? `Córdoba · ${weather.description}` : 'Clima · Córdoba'}
              >
                {weather ? (
                  <WeatherIconGlyph
                    icon={weather.icon}
                    className={`h-6 w-6 shrink-0 sm:h-7 sm:w-7 ${getWeatherInlineIconTone(weather.icon)}`}
                  />
                ) : null}
                <div className="min-w-0 text-right">
                  <p className="text-xl font-semibold tabular-nums leading-none text-neutral-900 dark:text-gray-100 sm:text-2xl">
                    {weather ? `${Math.round(weather.temperature)}°C` : '—'}
                  </p>
                  <p className="mt-1 text-[11px] leading-tight text-neutral-600 dark:text-gray-400">
                    {weather?.description ?? 'Córdoba'}
                  </p>
                </div>
              </div>
            )}

            {showDollar && <HomeDollarWidget />}
          </div>
        </div>
      </div>
    </header>
  )
}
