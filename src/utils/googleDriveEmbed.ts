const GOOGLE_DOC = 'application/vnd.google-apps.document'
const GOOGLE_SHEET = 'application/vnd.google-apps.spreadsheet'
const GOOGLE_SLIDES = 'application/vnd.google-apps.presentation'

export type DriveViewerMode = 'edit' | 'preview' | 'unsupported'

export interface DriveViewerUrls {
  mode: DriveViewerMode
  /** URL para iframe embebido en la intranet */
  embedUrl: string | null
  /** URL nativa de Google (pestaña completa) */
  nativeUrl: string
}

/**
 * URLs de embebido según tipo MIME de Drive.
 * Docs/Sheets/Slides: editor real (/edit). PDF/imagenes/otros binarios: /preview.
 * @see https://docs.google.com/document/d/{id}/edit
 * @see https://docs.google.com/spreadsheets/d/{id}/edit
 * @see https://drive.google.com/file/d/{id}/preview
 */
export function resolveGoogleDriveViewer(
  mimeType: string,
  fileId: string,
  webViewLink?: string | null,
): DriveViewerUrls {
  if (mimeType === GOOGLE_DOC) {
    return {
      mode: 'edit',
      embedUrl: `https://docs.google.com/document/d/${fileId}/edit?usp=sharing`,
      nativeUrl: `https://docs.google.com/document/d/${fileId}/edit`,
    }
  }

  if (mimeType === GOOGLE_SHEET) {
    return {
      mode: 'edit',
      embedUrl: `https://docs.google.com/spreadsheets/d/${fileId}/edit?usp=sharing`,
      nativeUrl: `https://docs.google.com/spreadsheets/d/${fileId}/edit`,
    }
  }

  if (mimeType === GOOGLE_SLIDES) {
    return {
      mode: 'edit',
      embedUrl: `https://docs.google.com/presentation/d/${fileId}/edit?usp=sharing`,
      nativeUrl: `https://docs.google.com/presentation/d/${fileId}/edit`,
    }
  }

  if (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('image/') ||
    (mimeType && !mimeType.startsWith('application/vnd.google-apps'))
  ) {
    return {
      mode: 'preview',
      embedUrl: `https://drive.google.com/file/d/${fileId}/preview`,
      nativeUrl: webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
    }
  }

  return {
    mode: 'unsupported',
    embedUrl: null,
    nativeUrl: webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`,
  }
}

export function canOpenDriveEmbedded(mimeType: string): boolean {
  return resolveGoogleDriveViewer(mimeType, 'placeholder').mode !== 'unsupported'
}
