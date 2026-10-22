/**
 * Host process entry — loads composition root; no ambient service locator.
 * Location: server/src/bootstrap/main.ts
 */
import { createHost } from './create-host.ts';

function redact(message: string): string {
  return message.replace(/(?:token|key|secret|password)=[^\s]+/gi, '$1=[redacted]');
}

function failStart(error: string, code = 1): never {
  console.error(JSON.stringify({ ready: false, error: redact(error) }));
  process.exit(code);
}

async function main(): Promise<void> {
  let host: ReturnType<typeof createHost>;
  try {
    host = createHost(process.env);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failStart(message);
  }

  if ('error' in host) {
    failStart(host.error, host.code);
  }

  const shutdown = async (signal: string) => {
    console.error(JSON.stringify({ event: 'shutdown', signal }));
    try {
      await host.stop();
      process.exit(0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(JSON.stringify({ event: 'shutdown-error', error: redact(message) }));
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await host.start();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failStart(message);
  }

  console.log(
    JSON.stringify({
      ready: true,
      host: host.config.host,
      port: host.config.port,
      dataDirFingerprint: host.dataDirFingerprint,
      mode: host.config.mode,
    }),
  );
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  failStart(message);
});
