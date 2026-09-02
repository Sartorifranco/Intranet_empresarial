/** IDs de widgets configurables en la home (tarjeta de bienvenida). */
export type HomeWidgetId = 'weather' | 'dollar'

export type HomeWidgetPreferences = Record<HomeWidgetId, boolean>

export const DEFAULT_HOME_WIDGET_PREFERENCES: HomeWidgetPreferences = {
  weather: true,
  dollar: true,
}

export interface HomeWidgetDefinition {
  id: HomeWidgetId
  label: string
  description: string
}

/** Registro extensible: agregar entradas al sumar widgets nuevos en la home. */
export const HOME_WIDGETS: HomeWidgetDefinition[] = [
  {
    id: 'weather',
    label: 'Clima',
    description: 'Temperatura actual en Córdoba',
  },
  {
    id: 'dollar',
    label: 'Dólar',
    description: 'Cotizaciones en vivo (oficial, blue, MEP)',
  },
]

export function resolveHomeWidgetPreferences(
  raw: Partial<HomeWidgetPreferences> | undefined | null,
): HomeWidgetPreferences {
  return {
    weather: raw?.weather !== false,
    dollar: raw?.dollar !== false,
  }
}
