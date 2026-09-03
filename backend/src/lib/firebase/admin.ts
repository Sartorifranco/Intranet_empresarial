import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getEnv } from '../../config/env.js'

export function initFirebaseAdmin(): 'ADMIN_SDK_KEY_PATH' | 'ADC' {
  const { adminSdkKeyPath } = getEnv()
  const mode = adminSdkKeyPath ? 'ADMIN_SDK_KEY_PATH' : 'ADC'

  if (getApps().length > 0) return mode

  // Local: JSON de firebase-adminsdk vía ADMIN_SDK_KEY_PATH (no FIREBASE_*: prefijo reservado).
  // Prod: sin path → ADC de Cloud Functions (identidad de runtime con permisos Firebase).
  if (adminSdkKeyPath) {
    initializeApp({
      credential: cert(adminSdkKeyPath),
    })
    return mode
  }

  initializeApp()
  return mode
}

export function adminAuth() {
  initFirebaseAdmin()
  return getAuth()
}

export function adminDb() {
  initFirebaseAdmin()
  return getFirestore()
}
