/**
 * HTTP status mapping for host transport errors (GATE-03 / MIG-020).
 * Location: server/src/api/errors.ts
 */
import type { TransportErrorCode } from '../application/transport/index.ts';

export function authDenyStatus(code: string): number {
  if (
    code === 'UNAUTHENTICATED' ||
    code === 'BEARER_FORBIDDEN' ||
    code === 'AUTH_NOT_CONFIGURED' ||
    code === 'SOLO_IDENTITY_FORBIDDEN'
  ) {
    return 401;
  }
  return 403;
}

export function transportStatus(code: TransportErrorCode): number {
  switch (code) {
    case 'INVALID_PAYLOAD':
      return 422;
    case 'FORBIDDEN':
      return 403;
    case 'STALE_REVISION':
    case 'IDEMPOTENCY_CONFLICT':
    case 'SESSION_MISMATCH':
      return 409;
    case 'HOST_SHUTTING_DOWN':
      return 503;
    default: {
      const _exhaustive: never = code;
      return _exhaustive;
    }
  }
}
