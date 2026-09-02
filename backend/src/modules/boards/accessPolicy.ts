/** Motivo mínimo para grant/revoke de acceso a tableros (solo super_admin). */
export const MIN_BOARD_ACCESS_REASON_LENGTH = 3

export function parseBoardAccessReason(
  value: unknown,
): { ok: true; reason: string } | { ok: false; error: string } {
  const reason = typeof value === 'string' ? value.trim() : ''
  if (reason.length < MIN_BOARD_ACCESS_REASON_LENGTH) {
    return {
      ok: false,
      error: `reason debe tener al menos ${MIN_BOARD_ACCESS_REASON_LENGTH} caracteres`,
    }
  }
  return { ok: true, reason }
}
