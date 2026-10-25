/**
 * Map host session-runtime errors to SQLSTATE-shaped codes (#867).
 * Location: server/src/application/session-runtime/map-session-error.ts
 */
export function mapSessionRuntimeError(error: string): string {
  switch (error) {
    case 'UNAUTHENTICATED':
    case 'FORBIDDEN':
      return '42501';
    case 'STALE_REVISION':
      return '40001';
    case 'SESSION_NOT_FOUND':
      return 'P0002';
    case 'INVALID_COMMAND':
    case 'INVALID_IDEMPOTENCY_KEY':
    case 'INVALID_REVISION':
    case 'INVALID_OPERATION':
    case 'IDEMPOTENCY_MISMATCH':
      return '22023';
    case 'DATABASE_BUSY':
      return '55P03';
    default:
      return 'P0001';
  }
}
