/**
 * SessionRuntimeState use-case — atomic persistent command processor (MIG-022).
 * Location: server/src/application/session/index.ts
 *
 * Vertical entry for host wiring. Persistence stays inside modules/session.
 */
import type { Actor } from '../../modules/identity/index.ts';
import type {
  ApplyCommandInput,
  ApplyCommandResult,
  SessionPorts,
} from '../../modules/session/index.ts';

export type SessionRuntimeUseCase = {
  readonly applyCommand: (actor: Actor, command: ApplyCommandInput) => ApplyCommandResult;
  readonly getSnapshot: (
    actor: Actor,
    sessionId: string,
  ) => ReturnType<SessionPorts['queries']['getSnapshot']>;
};

export function createSessionRuntimeUseCase(ports: SessionPorts): SessionRuntimeUseCase {
  return {
    applyCommand(actor, command) {
      return ports.commands.apply(actor, command);
    },
    getSnapshot(actor, sessionId) {
      return ports.queries.getSnapshot(actor, sessionId);
    },
  };
}
