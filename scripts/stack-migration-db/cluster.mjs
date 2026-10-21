import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, readFile, chmod, chown, rm, copyFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function nonRootIdentity() {
  if (process.getuid?.() !== 0) return {};
  // Existing unprivileged account only; never create a system account.
  return { uid: 65534, gid: 65534 };
}

export async function runChild(binary, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let output = '';
    for (const stream of [child.stdout, child.stderr]) {
      stream?.on('data', (chunk) => { output = (output + chunk.toString()).slice(-30_000); });
    }
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve(output);
      else reject(new Error(`${binary.split('/').at(-1)} failed (${code ?? signal}): ${output}`));
    });
  });
}

async function unusedPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate loopback port');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

export async function createCluster() {
  if (!['linux', 'darwin'].includes(process.platform)) {
    throw new Error('This baseline currently supports Linux/macOS only');
  }
  const binaryModule = await import(`@embedded-postgres/${process.platform}-${process.arch}`);
  const native = dirname(dirname(binaryModule.postgres));
  // pgjwt is SQL-only. Install pinned upstream extension files into the local
  // npm binary distribution, never into an OS PostgreSQL installation.
  for (const name of ['pgjwt.control', 'pgjwt--0.2.0.sql']) {
    await copyFile(join(here, 'vendor/pgjwt', name), join(native, 'share/postgresql/extension', name));
  }
  for (const binary of [binaryModule.postgres, binaryModule.initdb, binaryModule.pg_ctl]) {
    await chmod(binary, 0o755);
  }
  const identity = nonRootIdentity();
  if (identity.uid) {
    const passwd = await readFile('/etc/passwd', 'utf8');
    if (!passwd.split('\n').some((line) => line.startsWith('nobody:') && line.split(':')[2] === '65534')) {
      throw new Error('Root execution requires the pre-existing nobody UID 65534');
    }
  }
  const directory = await mkdtemp(join(tmpdir(), 'sagatree-migration-db-'));
  await chmod(directory, 0o700);
  if (identity.uid) await chown(directory, identity.uid, identity.gid);
  const data = join(directory, 'data');
  const socket = join(directory, 'socket');
  await mkdir(socket, { mode: 0o700 });
  if (identity.uid) await chown(socket, identity.uid, identity.gid);
  const password = randomBytes(24).toString('hex');
  const passwordFile = join(directory, 'password');
  await writeFile(passwordFile, password + '\n', { mode: 0o600 });
  if (identity.uid) await chown(passwordFile, identity.uid, identity.gid);
  const port = await unusedPort();
  const configuration = { host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres' };
  let processHandle;
  let log;
  async function start() {
    log = createWriteStream(join(directory, 'postgres.log'), { flags: 'a', mode: 0o600 });
    processHandle = spawn(binaryModule.postgres, [
      '-D', data, '-h', '127.0.0.1', '-p', String(port), '-k', socket,
      '-c', 'fsync=on', '-c', 'synchronous_commit=on', '-c', 'full_page_writes=on',
      '-c', 'wal_level=logical', '-c', 'max_connections=80',
    ], { ...identity, cwd: directory, stdio: ['ignore', 'pipe', 'pipe'] });
    let spawnError;
    processHandle.once('error', (error) => { spawnError = error; });
    processHandle.stdout.pipe(log, { end: false });
    processHandle.stderr.pipe(log, { end: false });
    for (let attempt = 0; attempt < 200; attempt += 1) {
      if (spawnError) throw spawnError;
      if (processHandle.exitCode !== null) {
        throw new Error(`PostgreSQL exited during startup: ${await readFile(join(directory, 'postgres.log'), 'utf8')}`);
      }
      const probe = new pg.Client({ ...configuration, connectionTimeoutMillis: 300 });
      try { await probe.connect(); await probe.end(); return; }
      catch { await probe.end().catch(() => {}); await delay(50); }
    }
    throw new Error('PostgreSQL did not become ready on its isolated loopback port');
  }
  async function stop(signal = 'SIGTERM') {
    if (processHandle && processHandle.exitCode === null && processHandle.signalCode === null) {
      const exited = once(processHandle, 'exit');
      processHandle.kill(signal);
      await exited;
    }
    if (log) await new Promise((resolve) => log.end(resolve));
  }
  try {
    await runChild(binaryModule.initdb, [
      '-D', data, '-U', 'postgres', '--encoding=UTF8', '--locale=C',
      '--auth-local=trust', '--auth-host=scram-sha-256', `--pwfile=${passwordFile}`,
    ], { ...identity, cwd: directory });
    await rm(passwordFile);
    await start();
  } catch (error) {
    await stop('SIGKILL').catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
  return {
    directory, configuration,
    async client(database = 'postgres') {
      const client = new pg.Client({ ...configuration, database });
      await client.connect();
      return client;
    },
    async restart() { await stop('SIGTERM'); await start(); },
    async crashAndRestart() { await stop('SIGKILL'); await start(); },
    async close() { await stop('SIGTERM'); await rm(directory, { recursive: true, force: true }); },
  };
}
