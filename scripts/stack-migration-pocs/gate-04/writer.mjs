import { CommandStore, POLICY } from './store.mjs';

let store;
let queue = Promise.resolve();
const paused = new Map();
const send = (message) => new Promise((resolve, reject) => process.send(message, (error) => error ? reject(error) : resolve()));

async function dispatch(message) {
  const { id, type } = message;
  if (type === 'init') {
    store = new CommandStore(message.path, message.tokens, message.options);
    await send({ type: 'reply', id, value: {
      ready: true,
      sqlite: store.db.prepare('SELECT sqlite_version() AS version').get().version,
      journalMode: store.db.prepare('PRAGMA journal_mode').get().journal_mode,
      synchronous: store.db.prepare('PRAGMA synchronous').get().synchronous,
      busyTimeoutMs: store.db.prepare('PRAGMA busy_timeout').get().timeout,
      walAutocheckpoint: store.db.prepare('PRAGMA wal_autocheckpoint').get().wal_autocheckpoint,
      policy: POLICY,
    } });
    return;
  }
  const hook = async (phase) => {
    if (message.failAt === phase) throw new Error('INJECTED_FAILURE');
    if (message.pauseAt !== phase) return;
    const resumed = new Promise((resolve) => paused.set(id, resolve));
    await send({ type: 'checkpoint', id, phase });
    await resumed;
  };
  if (type === 'apply') {
    const value = await store.apply(message.token, message.command, hook);
    // Result is emitted only after the SQLite COMMIT succeeds. A replay is byte-identical resultJson.
    await send({ type: 'reply', id, value });
    if (value.ok && value.committed) {
      await hook('before-broadcast');
      const result = JSON.parse(value.resultJson);
      await send({ type: 'broadcast', sessionId: result.sessionId, eventSequence: result.eventSequence, revision: result.revision });
    }
  } else if (type === 'reconnect') {
    await send({ type: 'reply', id, value: store.reconnect(message.token, message.sessionId, message.afterSequence) });
  } else if (type === 'stats') {
    await send({ type: 'reply', id, value: store.stats });
  } else if (type === 'checkpoint') {
    await send({ type: 'reply', id, value: store.db.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get() });
  } else if (type === 'revoke') {
    // Control-plane fixture operation; never part of the command API.
    store.db.prepare('DELETE FROM session_members WHERE session_id=? AND actor_user_id=?').run(message.sessionId, message.actor);
    await send({ type: 'reply', id, value: { revoked: true } });
  } else if (type === 'close') {
    store.close();
    await send({ type: 'reply', id, value: { closed: true } });
    process.disconnect();
  } else throw new Error(`Unknown fixture message: ${type}`);
}

process.on('message', (message) => {
  if (message.type === 'continue') {
    paused.get(message.id)?.();
    paused.delete(message.id);
    return;
  }
  queue = queue.then(() => dispatch(message)).catch(async (error) => {
    await send({ type: 'fatal', id: message.id, error: String(error.stack ?? error) });
    process.exitCode = 1;
  });
});
