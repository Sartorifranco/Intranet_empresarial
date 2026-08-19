/**
 * Valores de marca en TypeScript (referencia).
 * La fuente de verdad visual está en brand.css — mantener ambos sincronizados.
 */
export const brandTheme = {
  primary: '#8b0000',
  primaryHover: '#6b0000',
  primaryLight: '#fef2f2',
  primaryMuted: '#fee2e2',
  primaryText: '#8b0000',
  text: '#0a0a0a',
  textMuted: '#404040',
  textSubtle: '#737373',
  navbarBg: '#ffffff',
  navbarBorder: '#e5e5e5',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  surfaceMuted: '#fafafa',
} as const

export type BrandTheme = typeof brandTheme
