import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  DollarSign,
  Sun,
} from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'

interface WeatherData {
  temperature: number
  description: string
  icon: 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'fog' | 'storm'
}

interface DollarRate {
  label: string
  compra: number
  venta: number
}

const WEATHER_ICONS = {
  sun: Sun,
  'cloud-sun': CloudSun,
  cloud: Cloud,
  rain: CloudRain,
  fog: CloudFog,
  storm: CloudLightning,
} as const

function getWeatherInfo(code: number): Pick<WeatherData, 'description' | 'icon'> {
  if (code === 0) return { description: 'Despejado', icon: 'sun' }
  if (code <= 3) return { description: 'Parcialmente nublado', icon: 'cloud-sun' }
  if (code <= 48) return { description: 'Niebla', icon: 'fog' }
  if (code <= 67) return { description: 'Lluvia', icon: 'rain' }
  if (code <= 77) return { description: 'Nieve', icon: 'cloud' }
  if (code <= 82) return { description: 'Chaparrones', icon: 'rain' }
  if (code <= 99) return { description: 'Tormenta', icon: 'storm' }
  return { description: 'Nublado', icon: 'cloud' }
}

function formatCurrency(value: number) {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-gray-100 bg-white dark:bg-zinc-900/80 p-4">
      <div className="mb-2 h-3 w-16 rounded bg-gray-200" />
      <div className="h-7 w-24 rounded bg-gray-200" />
    </div>
  )
}

function WidgetCard({
  label,
  children,
  accent = 'text-gray-500 dark:text-gray-400',
  minimal = false,
}: {
  label: string
  children: ReactNode
  accent?: string
  minimal?: boolean
}) {
  if (minimal) {
    return (
      <div className="py-1">
        <p className={`mb-2 text-xs font-medium uppercase tracking-wide ${accent}`}>
          {label}
        </p>
        {children}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white dark:bg-zinc-900/90 p-4 shadow-sm backdrop-blur-sm">
      <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${accent}`}>
        {label}
      </p>
      {children}
    </div>
  )
}

export function DailyWidgets({ variant = 'default' }: { variant?: 'default' | 'minimal' }) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(true)
  const [weatherError, setWeatherError] = useState(false)

  const [dollars, setDollars] = useState<DollarRate[]>([])
  const [dollarsLoading, setDollarsLoading] = useState(true)
  const [dollarsError, setDollarsError] = useState(false)

  const greeting = (() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Buenos días'
    if (hour < 19) return 'Buenas tardes'
    return 'Buenas noches'
  })()

  useEffect(() => {
    const controller = new AbortController()

    fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=-31.4201&longitude=-64.1888&current=temperature_2m,weather_code&timezone=America%2FArgentina%2FCordoba',
      { signal: controller.signal },
    )
      .then((res) => {
        if (!res.ok) throw new Error('Weather fetch failed')
        return res.json()
      })
      .then((data) => {
        const info = getWeatherInfo(data.current.weather_code as number)
        setWeather({
          temperature: data.current.temperature_2m as number,
          ...info,
        })
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error al cargar el clima:', err)
          setWeatherError(true)
        }
      })
      .finally(() => setWeatherLoading(false))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    fetch('https://dolarapi.com/v1/dolares', { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error('Dollar fetch failed')
        return res.json()
      })
      .then((data: { casa: string; nombre: string; compra: number; venta: number }[]) => {
        const targets = [
          { casa: 'oficial', label: 'Oficial' },
          { casa: 'bolsa', label: 'MEP' },
          { casa: 'blue', label: 'Blue' },
        ]

        const rates = targets
          .map(({ casa, label }) => {
            const item = data.find((d) => d.casa === casa)
            if (!item) return null
            return { label, compra: item.compra, venta: item.venta }
          })
          .filter((item): item is DollarRate => item !== null)

        setDollars(rates)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error al cargar cotizaciones:', err)
          setDollarsError(true)
        }
      })
      .finally(() => setDollarsLoading(false))

    return () => controller.abort()
  }, [])

  const minimal = variant === 'minimal'

  const WeatherIcon = weather ? WEATHER_ICONS[weather.icon] : Sun

  return (
    <section
      className={
        minimal
          ? 'space-y-4'
          : 'rounded-2xl border border-gray-200 dark:border-zinc-800 bg-gradient-to-r from-slate-50 via-white to-sky-50 p-5 shadow-sm sm:p-6'
      }
    >
      <div className={`flex flex-wrap items-center justify-between gap-2 ${minimal ? '' : 'mb-4'}`}>
        <div>
          <p className={`text-sm font-medium ${minimal ? 'text-neutral-500 dark:text-gray-400' : 'text-sky-700'}`}>
            {greeting}
          </p>
          {!minimal && (
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Tu resumen del día</h2>
          )}
        </div>
        <p className="text-xs text-neutral-400">
          {new Date().toLocaleDateString('es-AR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </p>
      </div>

      <div className={`grid gap-3 ${minimal ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {weatherLoading ? (
          minimal ? (
            <p className="text-sm text-neutral-400">Cargando clima...</p>
          ) : (
            <CardSkeleton />
          )
        ) : weatherError || !weather ? (
          <WidgetCard label="Clima · Córdoba" accent={minimal ? 'text-neutral-500 dark:text-gray-400' : 'text-sky-600'} minimal={minimal}>
            <p className="text-sm text-gray-400">No disponible</p>
          </WidgetCard>
        ) : (
          <WidgetCard label="Clima · Córdoba" accent={minimal ? 'text-neutral-500 dark:text-gray-400' : 'text-sky-600'} minimal={minimal}>
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  minimal ? 'bg-neutral-100 dark:bg-zinc-800 text-neutral-700 dark:text-gray-300' : 'bg-sky-100 text-sky-600'
                }`}
              >
                <WeatherIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900 dark:text-gray-100">
                  {Math.round(weather.temperature)}°C
                </p>
                <p className="text-sm text-neutral-500 dark:text-gray-400">{weather.description}</p>
              </div>
            </div>
          </WidgetCard>
        )}

        {dollarsLoading ? (
          minimal ? (
            <p className="text-sm text-neutral-400">Cargando cotizaciones...</p>
          ) : (
            <>
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </>
          )
        ) : dollarsError || dollars.length === 0 ? (
          <WidgetCard label="Dólar hoy" accent={minimal ? 'text-neutral-500 dark:text-gray-400' : 'text-emerald-600 dark:text-emerald-400'} minimal={minimal}>
            <div className="flex items-center gap-2 text-gray-400">
              <DollarSign className="h-4 w-4" />
              <p className="text-sm">No disponible</p>
            </div>
          </WidgetCard>
        ) : (
          dollars.map((rate) => (
            <WidgetCard
              key={rate.label}
              label={`Dólar ${rate.label}`}
              accent={minimal ? 'text-neutral-500 dark:text-gray-400' : 'text-emerald-600 dark:text-emerald-400'}
              minimal={minimal}
            >
              <div className="flex items-start gap-2">
                <DollarSign
                  className={`mt-0.5 h-4 w-4 shrink-0 ${minimal ? 'text-neutral-400' : 'text-emerald-500'}`}
                />
                <div className="space-y-1 text-sm">
                  <p className="text-neutral-600 dark:text-gray-400">
                    Compra{' '}
                    <span className="font-bold text-neutral-900 dark:text-gray-100">
                      ${formatCurrency(rate.compra)}
                    </span>
                  </p>
                  <p className="text-neutral-600 dark:text-gray-400">
                    Venta{' '}
                    <span className="font-bold text-neutral-900 dark:text-gray-100">
                      ${formatCurrency(rate.venta)}
                    </span>
                  </p>
                </div>
              </div>
            </WidgetCard>
          ))
        )}
      </div>
    </section>
  )
}
