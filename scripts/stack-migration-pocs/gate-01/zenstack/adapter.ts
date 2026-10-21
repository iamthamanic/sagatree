import { createHash } from 'node:crypto';
import { CommandError, validateStatus, validateUpdate, type AdapterHandle, type ApplicationPort, type FaultHook } from '../domain/contracts.js';
import { openPolicyClient } from './engine.js';

/** Authorization is exclusively in generated ZModel policies + the real PolicyPlugin. */
export function createAdapter(file: string, fault?: FaultHook): AdapterHandle {
  const engine = openPolicyClient(file);
  const app = Object.freeze<ApplicationPort>({
    async listMaps(context) {
      const db = engine.forContext(context);
      const project = context.sagaId ? await db.project.findUnique({ where: { id: context.sagaId } }) : null;
      if (!project) throw new CommandError('DENIED');
      return db.map.findMany({ where: { worldId: project.worldId }, orderBy: { id: 'asc' } });
    },
    async getMap(mapId, context) {
      const db = engine.forContext(context);
      const project = context.sagaId ? await db.project.findUnique({ where: { id: context.sagaId } }) : null;
      if (!project) throw new CommandError('DENIED');
      return db.map.findFirst({ where: { id: mapId, worldId: project.worldId } });
    },
    async updateMapTitle(request, actor) {
      validateUpdate(request);
      const db = engine.forContext({ actor, sagaId: undefined });
      return db.$transaction(async (tx) => {
        const id = JSON.stringify([actor?.userId ?? null, request.mapId, request.idempotencyKey]);
        const digest = createHash('sha256').update(JSON.stringify([request.mapId, request.title, request.expectedRevision])).digest('hex');
        const receipt = await tx.commandReceipt.findUnique({ where: { id } });
        if (receipt) {
          if (receipt.requestDigest !== digest) throw new CommandError('IDEMPOTENCY_MISMATCH');
          return { id: request.mapId, title: receipt.resultTitle, revision: receipt.resultRevision };
        }
        const current = await tx.map.findUnique({ where: { id: request.mapId }, select: { revision: true } });
        if (!current) throw new CommandError('DENIED');
        if (current.revision !== request.expectedRevision) throw new CommandError('CONFLICT');
        const updated = await tx.map.update({
          where: { id: request.mapId, revision: request.expectedRevision },
          data: { title: request.title, revision: { increment: 1 } },
          select: { id: true, title: true, revision: true },
        });
        fault?.('after-map-update');
        await tx.commandReceipt.create({ data: {
          id, mapId: request.mapId, actorUserId: actor?.userId ?? '', requestDigest: digest,
          resultTitle: updated.title, resultRevision: updated.revision,
        } });
        return updated;
      });
    },
    async setSessionStatus(sessionId, status, context) {
      validateStatus(status);
      return engine.forContext(context).$transaction(async (tx) => tx.session.update({
        where: { id: sessionId }, data: { status, revision: { increment: 1 } },
      }));
    },
  });
  return { app, close: () => engine.close() };
}
