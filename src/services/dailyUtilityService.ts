const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=-31.4135&longitude=-64.1810&current_weather=true'

export type WeatherIcon = 'sun' | 'cloud-sun' | 'cloud' | 'rain' | 'fog' | 'storm'

export interface WeatherSnapshot {
  temperature: number
  description: string
  icon: WeatherIcon
}

export interface FxQuote {
  id: string
  label: string
  compra: number
  venta: number
}

interface OpenMeteoResponse {
  current_weather: {
    temperature: number
    weathercode: number
  }
}

interface DolarApiEntry {
  casa: string
  compra: number
  venta: number
}

export function getWeatherInfo(code: number): Pick<WeatherSnapshot, 'description' | 'icon'> {
  if (code === 0) return { description: 'Despejado', icon: 'sun' }
  if (code <= 3) return { description: 'Parcialmente nublado', icon: 'cloud-sun' }
  if (code <= 48) return { description: 'Niebla', icon: 'fog' }
  if (code <= 67) return { description: 'Lluvia', icon: 'rain' }
  if (code <= 77) return { description: 'Nieve', icon: 'cloud' }
  if (code <= 82) return { description: 'Chaparrones', icon: 'rain' }
  if (code <= 99) return { description: 'Tormenta', icon: 'storm' }
  return { description: 'Nublado', icon: 'cloud' }
}

export async function fetchCordobaWeather(signal?: AbortSignal): Promise<WeatherSnapshot> {
  const response = await fetch(OPEN_METEO_URL, { signal })
  if (!response.ok) throw new Error('Open-Meteo request failed')

  const data = (await response.json()) as OpenMeteoResponse
  const current = data.current_weather

  if (!current) throw new Error('Open-Meteo response incomplete')

  const info = getWeatherInfo(current.weathercode)

  return {
    temperature: current.temperature,
    ...info,
  }
}

export async function fetchFxQuotes(signal?: AbortSignal): Promise<FxQuote[]> {
  const response = await fetch('https://dolarapi.com/v1/dolares', { signal })
  if (!response.ok) throw new Error('DolarApi request failed')

  const dolarData = (await response.json()) as DolarApiEntry[]
  const targets = [
    { casa: 'oficial', id: 'oficial', label: 'Oficial' },
    { casa: 'blue', id: 'blue', label: 'Blue' },
    { casa: 'bolsa', id: 'mep', label: 'MEP' },
  ]

  const quotes: FxQuote[] = []

  for (const { casa, id, label } of targets) {
    const entry = dolarData.find((item) => item.casa === casa)
    if (!entry) continue
    quotes.push({
      id,
      label,
      compra: entry.compra,
      venta: entry.venta,
    })
  }

  return quotes
}

export function formatArs(value: number): string {
  return value.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}
