/**
 * Host process entry — loads composition root; no ambient service locator.
 * Location: server/src/bootstrap/main.ts
 */
import { createHost } from './create-host.ts';

async function main(): Promise<void> {
  const host = createHost(process.env);
  if ('error' in host) {
    console.error(JSON.stringify({ ready: false, error: host.error }));
    process.exit(host.code);
  }

  const shutdown = async (signal: string) => {
    console.error(JSON.stringify({ event: 'shutdown', signal }));
    try {
      await host.stop();
      process.exit(0);
    } catch (err) {
      console.error(JSON.stringify({ event: 'shutdown-error', error: String(err) }));
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  try {
    await host.start();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = /EADDRINUSE/.test(message) ? 1 : 1;
    console.error(JSON.stringify({ ready: false, error: message.replace(/(token|key|secret|password)=[^\s]+/gi, '$1=[redacted]') }));
    process.exit(code);
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

void main();
