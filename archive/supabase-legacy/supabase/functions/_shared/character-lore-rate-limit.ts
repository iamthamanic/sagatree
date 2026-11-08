export interface CharacterLoreRateLimitConfig {
  url: string;
  serviceRoleKey: string;
  limit: number;
  windowSeconds: number;
}

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

const RATE_LIMIT_RPC = '/rest/v1/rpc/consume_character_lore_rate_limit';

export async function consumePersistentCharacterLoreRateLimit(
  config: CharacterLoreRateLimitConfig,
  userId: string,
  fetchImpl: FetchLike = fetch,
): Promise<boolean> {
  if (!userId.trim()) throw new Error('Rate limit user id is required');
  if (!Number.isInteger(config.limit) || config.limit < 1 || config.limit > 60) {
    throw new Error('Rate limit must be an integer between 1 and 60');
  }
  if (
    !Number.isInteger(config.windowSeconds) ||
    config.windowSeconds < 1 ||
    config.windowSeconds > 3600
  ) {
    throw new Error('Rate limit window must be an integer between 1 and 3600 seconds');
  }

  const response = await fetchImpl(`${config.url.replace(/\/+$/, '')}${RATE_LIMIT_RPC}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.serviceRoleKey}`,
      apikey: config.serviceRoleKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      p_user_id: userId,
      p_limit: config.limit,
      p_window_seconds: config.windowSeconds,
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Persistent rate limit RPC returned ${response.status}`);
  }

  const body: unknown = await response.json();
  if (typeof body !== 'boolean') {
    throw new Error('Persistent rate limit RPC returned an invalid response');
  }

  return body;
}
