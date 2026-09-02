import { adminDb } from '../../lib/firebase/admin.js'

const DEFAULT_MIN_REASON = 15

export async function getMinReasonLength(): Promise<number> {
  const snap = await adminDb().collection('appSettings').doc('global').get()
  const raw = snap.exists ? snap.get('minReasonLength') : undefined
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }
  return DEFAULT_MIN_REASON
}

export async function getAllowedUploadMimeTypes(): Promise<string[]> {
  const snap = await adminDb()
    .collection('allowedMimeTypes')
    .where('allowed', '==', true)
    .get()

  const mimes: string[] = []
  for (const doc of snap.docs) {
    const mime = doc.get('mimeType')
    if (typeof mime === 'string' && mime.length > 0) {
      mimes.push(mime)
    }
  }
  mimes.sort((a, b) => a.localeCompare(b))
  return mimes
}
