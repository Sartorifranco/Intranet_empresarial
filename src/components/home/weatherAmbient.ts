import type { WeatherIcon } from '../../services/dailyUtilityService'

export interface WeatherAmbientStyle {
  light: string
  dark: string
}

/** Degradé ambiental según condición climática (esquina superior derecha). */
export function getWeatherAmbientStyle(icon: WeatherIcon): WeatherAmbientStyle {
  switch (icon) {
    case 'sun':
      return {
        light:
          'radial-gradient(ellipse 90% 75% at 100% 0%, rgb(250 204 21 / 0.55) 0%, rgb(253 224 71 / 0.28) 38%, transparent 75%)',
        dark:
          'radial-gradient(ellipse 90% 75% at 100% 0%, rgb(234 179 8 / 0.38) 0%, rgb(202 138 4 / 0.16) 40%, transparent 75%)',
      }
    case 'moon':
      return {
        light:
          'radial-gradient(ellipse 90% 75% at 100% 0%, rgb(129 140 248 / 0.28) 0%, rgb(199 210 254 / 0.14) 40%, transparent 75%)',
        dark:
          'radial-gradient(ellipse 90% 75% at 100% 0%, rgb(99 102 241 / 0.32) 0%, rgb(67 56 202 / 0.14) 42%, transparent 75%)',
      }
    case 'cloud-sun':
      return {
        light:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(251 191 36 / 0.32) 0%, rgb(148 163 184 / 0.14) 45%, transparent 72%)',
        dark:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(217 119 6 / 0.22) 0%, rgb(100 116 139 / 0.1) 45%, transparent 72%)',
      }
    case 'fog':
      return {
        light:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(203 213 225 / 0.55) 0%, rgb(226 232 240 / 0.2) 40%, transparent 72%)',
        dark:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(100 116 139 / 0.35) 0%, rgb(71 85 105 / 0.15) 40%, transparent 72%)',
      }
    case 'cloud-rain':
      return {
        light:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(56 189 248 / 0.22) 0%, rgb(100 116 139 / 0.2) 42%, transparent 72%)',
        dark:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(14 116 144 / 0.28) 0%, rgb(51 65 85 / 0.18) 42%, transparent 72%)',
      }
    case 'cloud-snow':
      return {
        light:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(186 230 253 / 0.55) 0%, rgb(148 163 184 / 0.18) 42%, transparent 72%)',
        dark:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(125 211 252 / 0.25) 0%, rgb(71 85 105 / 0.15) 42%, transparent 72%)',
      }
    case 'cloud-lightning':
      return {
        light:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(139 92 246 / 0.28) 0%, rgb(100 116 139 / 0.18) 42%, transparent 72%)',
        dark:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(109 40 217 / 0.32) 0%, rgb(51 65 85 / 0.2) 42%, transparent 72%)',
      }
    case 'cloud-lightning-rain':
      return {
        light:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(124 58 237 / 0.26) 0%, rgb(56 189 248 / 0.14) 38%, transparent 72%)',
        dark:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(91 33 182 / 0.3) 0%, rgb(14 116 144 / 0.16) 40%, transparent 72%)',
      }
    case 'cloud':
    default:
      return {
        light:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(148 163 184 / 0.35) 0%, rgb(203 213 225 / 0.12) 42%, transparent 72%)',
        dark:
          'radial-gradient(ellipse 85% 70% at 100% 0%, rgb(100 116 139 / 0.32) 0%, rgb(71 85 105 / 0.12) 42%, transparent 72%)',
      }
  }
}
