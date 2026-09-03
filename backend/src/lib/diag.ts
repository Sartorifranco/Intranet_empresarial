import { getEnv } from '../config/env.js'

/** Emulador de Functions o NODE_ENV=development. Nunca en Cloud Functions de prod. */
export function isBackendDev(): boolean {
  return process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development'
}

export function logCredentialDiagnostics(adminMode: 'ADMIN_SDK_KEY_PATH' | 'ADC'): void {
  if (!isBackendDev()) return

  const gac = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  const { adminSdkKeyPath, driveServiceAccountKeyPath } = getEnv()

  console.info('======== diagnóstico de credenciales (solo dev) ========')

  if (gac) {
    console.warn(
      '[WARN] GOOGLE_APPLICATION_CREDENTIALS está seteada y no debería usarse con el esquema nuevo:',
      gac,
    )
  } else {
    console.info('GOOGLE_APPLICATION_CREDENTIALS: no seteada')
  }

  if (adminMode === 'ADMIN_SDK_KEY_PATH' && adminSdkKeyPath) {
    console.info('Admin SDK: usando cert desde ADMIN_SDK_KEY_PATH:', adminSdkKeyPath)
  } else {
    console.info('Admin SDK: usando ADC (initializeApp sin cert)')
  }

  if (driveServiceAccountKeyPath) {
    console.info(
      'Drive: usando keyFile desde DRIVE_SERVICE_ACCOUNT_KEY_PATH:',
      driveServiceAccountKeyPath,
    )
  } else {
    console.info('Drive: sin keyFile, usando IAM signJwt')
  }

  console.info('========================================================')
}
