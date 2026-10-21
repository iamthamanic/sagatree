import { spawn } from 'node:child_process';
import { createHmac, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import http from 'node:http';
import net from 'node:net';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function signedAnon(secret) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const data = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'anon', iss: 'isolated-migration-fixture', iat: now, exp: now + 3600 })}`;
  return `${data}.${createHmac('sha256', secret).update(data).digest('base64url')}`;
}

async function startProcess(binary, args, env) {
  const child = spawn(binary, args, { env: { PATH: process.env.PATH, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  let startError;
  child.once('error', (error) => { startError = error; });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { log = (log + data).slice(-20_000); });
  return {
    async ready(url) {
      for (let attempt = 0; attempt < 150; attempt += 1) {
        if (startError) throw startError;
        if (child.exitCode !== null) throw new Error(`${binary.split('/').at(-1)} exited: ${log}`);
        try { const response = await fetch(url); if (response.ok) { await response.body?.cancel(); return; } }
        catch { /* The process may still be binding its loopback socket. */ }
        await delay(100);
      }
      throw new Error(`Real service did not become healthy at ${url}: ${log}`);
    },
    async close() {
      if (child.exitCode !== null || child.signalCode !== null) return;
      const stopped = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      const force = setTimeout(() => child.kill('SIGKILL'), 5000);
      await stopped;
      clearTimeout(force);
    },
  };
}

export async function startServices(cluster, toolsDirectory, frontendPort) {
  const sources = JSON.parse(await readFile(join(toolsDirectory, 'sources.json'), 'utf8'));
  for (const source of sources) {
    const { createHash } = await import('node:crypto');
    const actual = createHash('sha256').update(await readFile(join(toolsDirectory, source.name))).digest('hex');
    if (actual !== source.sha256) throw new Error(`Service binary checksum mismatch: ${source.name}`);
  }
  if (!['gotrue', 'postgrest'].every((name) => sources.some((source) => source.name === name))) throw new Error('Provisioned real service binaries are required');
  const [authPort, restPort, gatewayPort] = await Promise.all([unusedPort(), unusedPort(), unusedPort()]);
  const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;
  const secret = randomBytes(48).toString('base64url');
  const c = cluster.configuration;
  const databaseUrl = `postgresql://${c.user}:${c.password}@127.0.0.1:${c.port}/${c.database}?sslmode=disable`;
  let auth;
  let rest;
  const proxy = http.createServer((incoming, outgoing) => {
    const prefix = incoming.url.startsWith('/auth/v1/') ? '/auth/v1' : incoming.url.startsWith('/rest/v1/') ? '/rest/v1' : null;
    if (!prefix) { outgoing.writeHead(503); outgoing.end('This isolated fixture runs GoTrue and PostgREST only.'); return; }
    const request = http.request({
      hostname: '127.0.0.1', port: prefix === '/auth/v1' ? authPort : restPort,
      method: incoming.method, path: incoming.url.slice(prefix.length), headers: incoming.headers,
    }, (response) => { outgoing.writeHead(response.statusCode, response.headers); response.pipe(outgoing); });
    request.on('error', () => { if (!outgoing.headersSent) outgoing.writeHead(502); outgoing.end(); });
    incoming.pipe(request);
  });
  // Transparent routing only: all auth/RPC bodies and status codes originate
  // from the real upstream binaries. No test result is fulfilled by this proxy.
  await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(gatewayPort, '127.0.0.1', resolve); });
  const close = async () => {
    await Promise.allSettled([auth?.close(), rest?.close()]);
    proxy.closeAllConnections();
    await new Promise((resolve) => proxy.close(resolve));
  };
  try {
    auth = await startProcess(join(toolsDirectory, 'gotrue'), ['serve'], {
      GOTRUE_API_HOST: '127.0.0.1', GOTRUE_API_PORT: String(authPort),
      API_EXTERNAL_URL: `${gatewayUrl}/auth/v1`, GOTRUE_SITE_URL: `http://127.0.0.1:${frontendPort}`,
      GOTRUE_DB_DRIVER: 'postgres', GOTRUE_DB_DATABASE_URL: `${databaseUrl}&search_path=auth`,
      GOTRUE_DB_NAMESPACE: 'auth', GOTRUE_JWT_SECRET: secret, GOTRUE_JWT_AUD: 'authenticated',
      GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated', GOTRUE_JWT_EXP: '3600',
      GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true', GOTRUE_MAILER_AUTOCONFIRM: 'true', GOTRUE_DISABLE_SIGNUP: 'true',
      // Compose's Kong CORS plugin accepts these SDK headers. Direct GoTrue
      // serving needs its official additional-header setting for the same path.
      GOTRUE_CORS_ALLOWED_HEADERS: 'apikey,x-supabase-api-version',
    });
    rest = await startProcess(join(toolsDirectory, 'postgrest'), [], {
      PGRST_DB_URI: databaseUrl, PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: secret, PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(restPort),
      PGRST_DB_POOL: '10',
    });
    await Promise.all([auth.ready(`http://127.0.0.1:${authPort}/health`), rest.ready(`http://127.0.0.1:${restPort}/`)]);
    return { gatewayUrl, anonKey: signedAnon(secret), sources, close };
  } catch (error) { await close(); throw error; }
}
