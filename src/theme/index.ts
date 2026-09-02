/**
 * Valores de marca en TypeScript (referencia).
 * La fuente de verdad visual está en brand.css — mantener ambos sincronizados.
 */
export const brandTheme = {
  primary: '***REMOVED***1E3A5F',
  primaryHover: '***REMOVED***152d4a',
  primaryLight: '***REMOVED***e8eef5',
  primaryMuted: '***REMOVED***c5d4e4',
  primaryText: '***REMOVED***1E3A5F',
  text: '***REMOVED***202124',
  textMuted: '***REMOVED***5f6368',
  textSubtle: '***REMOVED***80868b',
  navbarBg: '***REMOVED***ffffff',
  navbarBorder: '***REMOVED***dadce0',
  surface: '***REMOVED***ffffff',
  surfaceElevated: '***REMOVED***ffffff',
  surfaceMuted: '***REMOVED***f8f9fa',
} as const

export type BrandTheme = typeof brandTheme
