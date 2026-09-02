import type { WeatherIcon } from '../../services/dailyUtilityService'
import { getWeatherIconLabel, getWeatherIconTone, WeatherIconGlyph } from '../weather/weatherIcons'

interface WeatherAmbientIllustrationProps {
  icon: WeatherIcon
}

/** Ícono grande decorativo en la esquina superior derecha de la tarjeta de bienvenida. */
export function WeatherAmbientIllustration({ icon }: WeatherAmbientIllustrationProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -right-2 -top-1 z-[1] sm:right-2 sm:top-1"
      title={getWeatherIconLabel(icon)}
    >
      <WeatherIconGlyph
        icon={icon}
        className={`h-[5.5rem] w-[5.5rem] sm:h-[6.5rem] sm:w-[6.5rem] ${getWeatherIconTone(icon)}`}
      />
    </div>
  )
}
