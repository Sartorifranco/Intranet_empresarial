import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  DollarSign,
  RefreshCw,
  Sun,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import {
  fetchCordobaWeather,
  fetchFxQuotes,
  formatArs,
  type FxQuote,
  type WeatherIcon,
  type WeatherSnapshot,
} from '../services/dailyUtilityService'

const WEATHER_ICONS = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  rain: CloudRain,
  fog: CloudFog,
  storm: CloudLightning,
} as const

function WidgetSkeleton() {
  return (
    <section className="card-minimal overflow-hidden dark:bg-zinc-900">
      <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 lg:px-5 lg:py-4">
        <div className="h-4 w-32 animate-pulse rounded bg-neutral-200 dark:bg-zinc-700" />
        <div className="mt-2 h-3 w-48 animate-pulse rounded bg-neutral-100 dark:bg-zinc-800" />
      </div>
      <div className="space-y-4 p-4 lg:p-5">
        <div className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-zinc-800" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-zinc-800" />
          ))}
        </div>
      </div>
    </section>
  )
}

function RateRow({ quote }: { quote: FxQuote }) {
  return (
    <div className="rounded-lg border border-neutral-100 bg-neutral-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-800/40">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-gray-400">
        Dólar {quote.label}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-gray-500">
            Compra
          </p>
          <p className="text-sm font-bold tabular-nums text-neutral-900 dark:text-white">
            ${formatArs(quote.compra)}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-neutral-400 dark:text-gray-500">
            Venta
          </p>
          <p className="text-sm font-bold tabular-nums text-neutral-900 dark:text-white">
            ${formatArs(quote.venta)}
          </p>
        </div>
      </div>
    </div>
  )
}

function WeatherDisplay({ weather }: { weather: WeatherSnapshot }) {
  const Icon = WEATHER_ICONS[weather.icon as WeatherIcon]

  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-neutral-900 dark:text-white">
          {Math.round(weather.temperature)}°C
        </p>
        <p className="text-sm text-neutral-500 dark:text-gray-400">{weather.description}</p>
      </div>
    </div>
  )
}

export function DailyUtilityWidget() {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const [weatherError, setWeatherError] = useState(false)

  const [quotes, setQuotes] = useState<FxQuote[]>([])
  const [fxLoading, setFxLoading] = useState(true)
  const [fxError, setFxError] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async (signal?: AbortSignal) => {
    setWeatherError(false)
    setFxError(false)

    const [weatherResult, fxResult] = await Promise.allSettled([
      fetchCordobaWeather(signal),
      fetchFxQuotes(signal),
    ])

    if (signal?.aborted) return

    if (weatherResult.status === 'fulfilled') {
      setWeather(weatherResult.value)
    } else if (weatherResult.reason?.name !== 'AbortError') {
      console.error('Error al cargar clima:', weatherResult.reason)
      setWeatherError(true)
    }

    if (fxResult.status === 'fulfilled') {
      setQuotes(fxResult.value)
      if (fxResult.value.length === 0) setFxError(true)
    } else if (fxResult.reason?.name !== 'AbortError') {
      console.error('Error al cargar cotizaciones:', fxResult.reason)
      setFxError(true)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    loadData(controller.signal).finally(() => {
      if (!controller.signal.aborted) {
        setWeatherLoading(false)
        setFxLoading(false)
      }
    })

    return () => controller.abort()
  }, [loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setWeatherLoading(false)
    setFxLoading(false)
    setRefreshing(false)
  }

  if (weatherLoading && fxLoading) {
    return <WidgetSkeleton />
  }

  const todayLabel = new Date().toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  })

  return (
    <section className="card-minimal overflow-hidden dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900 lg:px-5 lg:py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-white">
            Utilidades del día
          </h2>
          <p className="text-xs capitalize text-neutral-500 dark:text-gray-400">{todayLabel}</p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Actualizar clima y cotizaciones"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 transition-colors hover:bg-white hover:text-neutral-800 disabled:opacity-50 dark:border-zinc-700 dark:text-gray-400 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="p-4 lg:p-5">
        {/* Clima */}
        <div>
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-widest text-sky-700 dark:text-sky-400">
            Clima · Córdoba
          </p>

          {weatherLoading ? (
            <div className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-zinc-800" />
          ) : weatherError || !weather ? (
            <p className="text-sm text-neutral-400 dark:text-gray-500">Clima no disponible</p>
          ) : (
            <WeatherDisplay weather={weather} />
          )}
        </div>

        <div
          className="my-4 border-t border-neutral-100 dark:border-zinc-800"
          role="separator"
        />

        {/* Cotizaciones */}
        <div>
          <div className="mb-2.5 flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
              Cotizaciones · ARS
            </p>
          </div>

          {fxLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100 dark:bg-zinc-800" />
              ))}
            </div>
          ) : fxError || quotes.length === 0 ? (
            <p className="text-sm text-neutral-400 dark:text-gray-500">
              Cotizaciones no disponibles
            </p>
          ) : (
            <div className="space-y-2">
              {quotes.map((quote) => (
                <RateRow key={quote.id} quote={quote} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
