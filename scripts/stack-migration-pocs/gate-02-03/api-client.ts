export interface PingSessionCommand { sessionId: 'demo'; commandId: string }
export interface CommandAck { ok: true; sessionId: 'demo'; commandId: string; revision: number }
export interface Snapshot { ok: true; sessionId: 'demo'; revision: number; value: number }
export interface ApiFailure { ok: false; error: { code: string } }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCounter = (value: unknown, minimum: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
export const isCommandAck = (value: unknown): value is CommandAck => isRecord(value)
  && value.ok === true && value.sessionId === 'demo'
  && typeof value.commandId === 'string' && value.commandId.length > 0 && value.commandId.length <= 128
  && isCounter(value.revision, 1);
export const isSnapshot = (value: unknown): value is Snapshot => isRecord(value)
  && value.ok === true && value.sessionId === 'demo'
  && isCounter(value.revision, 0) && isCounter(value.value, 0);
export const isApiFailure = (value: unknown): value is ApiFailure => isRecord(value)
  && value.ok === false && isRecord(value.error)
  && typeof value.error.code === 'string' && value.error.code.length > 0;

export function decodeCommandAck(value: unknown): CommandAck | ApiFailure {
  if (isCommandAck(value) || isApiFailure(value)) return value;
  throw new Error('INVALID_RESPONSE');
}
export function decodeSnapshot(value: unknown): Snapshot | ApiFailure {
  if (isSnapshot(value) || isApiFailure(value)) return value;
  throw new Error('INVALID_RESPONSE');
}

export function createCandidateClient(origin: string, headers: Record<string, string>) {
  const request = async <T extends CommandAck | Snapshot>(path: string, decode: (value: unknown) => T | ApiFailure, body?: unknown): Promise<T | ApiFailure> => {
    const response = await fetch(`${origin}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...headers, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    let value: unknown;
    try { value = await response.json(); } catch { throw new Error('INVALID_RESPONSE'); }
    const decoded = decode(value);
    if (response.ok !== decoded.ok) throw new Error('INVALID_RESPONSE');
    return decoded;
  };
  return {
    pingSession: (command: PingSessionCommand) => request('/api/ping-session', decodeCommandAck, command),
    getSnapshot: () => request('/api/snapshot?sessionId=demo', decodeSnapshot),
  };
}
