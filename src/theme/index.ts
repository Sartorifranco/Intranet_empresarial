/**
 * Valores de marca en TypeScript (referencia).
 * La fuente de verdad visual está en brand.css — mantener ambos sincronizados.
 */
export const brandTheme = {
  primary: '***REMOVED***8b0000',
  primaryHover: '***REMOVED***6b0000',
  primaryLight: '***REMOVED***fef2f2',
  primaryMuted: '***REMOVED***fee2e2',
  primaryText: '***REMOVED***8b0000',
  text: '***REMOVED***0a0a0a',
  textMuted: '***REMOVED***404040',
  textSubtle: '***REMOVED***737373',
  navbarBg: '***REMOVED***ffffff',
  navbarBorder: '***REMOVED***e5e5e5',
  surface: '***REMOVED***ffffff',
  surfaceElevated: '***REMOVED***ffffff',
  surfaceMuted: '***REMOVED***fafafa',
} as const

export type BrandTheme = typeof brandTheme
