/**
 * Shared network timeouts for auth bootstrap and host HTTP calls.
 * Prevents the UI from hanging when the self-host stack is unreachable.
 * Location: src/lib/networkTimeout.ts
 */

export const AUTH_SESSION_TIMEOUT_MS = 1_500;
export const HOST_QUERY_TIMEOUT_MS = 5_000;

export const TIMED_OUT = Symbol('network-timeout');

export type TimedOut = typeof TIMED_OUT;

export function isTimedOut<T>(value: T | TimedOut): value is TimedOut {
  return value === TIMED_OUT;
}

export function raceWithTimeout<T>(promise: PromiseLike<T>, fallback: T, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((resolve) => {
      window.setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

export function raceWithTimeoutOrSymbol<T>(promise: PromiseLike<T>, ms: number): Promise<T | TimedOut> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<TimedOut>((resolve) => {
      window.setTimeout(() => resolve(TIMED_OUT), ms);
    }),
  ]);
}

export function raceWithTimeoutReject<T>(promise: PromiseLike<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), ms);
    }),
  ]);
}
