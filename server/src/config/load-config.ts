/**
 * Host configuration loader — loopback-first, no secrets in logs.
 * Location: server/src/config/load-config.ts
 */
import { accessSync, constants, mkdirSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

export type HostConfig = {
  readonly host: string;
  readonly port: number;
  readonly dataDir: string;
  readonly mode: 'solo';
};

export type ConfigError = {
  readonly code: 'INVALID_CONFIG' | 'DATA_DIR_NOT_WRITABLE';
  readonly message: string;
};

function redacted(message: string): string {
  return message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '$1=[redacted]');
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HostConfig | ConfigError {
  const host = (env.SAGATREE_HOST ?? '127.0.0.1').trim();
  if (host !== '127.0.0.1' && host !== 'localhost' && env.SAGATREE_ALLOW_REMOTE_BIND !== '1') {
    return {
      code: 'INVALID_CONFIG',
      message: redacted(
        `Remote bind to ${host} requires SAGATREE_ALLOW_REMOTE_BIND=1; default is loopback only.`,
      ),
    };
  }

  const portRaw = env.SAGATREE_PORT ?? '8787';
  const port = Number(portRaw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { code: 'INVALID_CONFIG', message: redacted(`Invalid SAGATREE_PORT: ${portRaw}`) };
  }

  const dataDirRaw = env.SAGATREE_DATA_DIR;
  if (!dataDirRaw || !String(dataDirRaw).trim()) {
    return { code: 'INVALID_CONFIG', message: 'SAGATREE_DATA_DIR is required' };
  }
  const dataDir = isAbsolute(dataDirRaw) ? dataDirRaw : resolve(process.cwd(), dataDirRaw);

  try {
    mkdirSync(dataDir, { recursive: true });
    accessSync(dataDir, constants.W_OK);
  } catch {
    return {
      code: 'DATA_DIR_NOT_WRITABLE',
      message: redacted(`Data directory is not writable: ${dataDir}`),
    };
  }

  return { host, port, dataDir, mode: 'solo' };
}
