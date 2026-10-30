/**
 * edge-main dispatcher use-case (MIG-414 / #830) — isolated-contract.
 * Location: server/src/application/edge-main/index.ts
 *
 * HTTP mount deferred (authorized host routes + MIG-600). publicActivationAuthorized=false.
 * Live Edge `main` remains the production dispatcher.
 */
import {
  EDGE_MAIN_DISPATCHER_STATUS,
  EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED,
  EDGE_MAIN_WORKER_MEMORY_LIMIT_MB,
  EDGE_MAIN_WORKER_TIMEOUT_MS,
  describeEdgeMainLegacyDefects,
  dispatchEdgeMainRequest,
  evaluatePostDispatcherWorkerAuth,
  type EdgeMainDispatchResult,
  type EdgeMainEnv,
} from '../../http/edge-main-dispatcher.ts';

export {
  EDGE_MAIN_DISPATCHER_STATUS,
  EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED,
  EDGE_MAIN_WORKER_MEMORY_LIMIT_MB,
  EDGE_MAIN_WORKER_TIMEOUT_MS,
  describeEdgeMainLegacyDefects,
  evaluatePostDispatcherWorkerAuth,
};

export type EdgeMainUseCaseDeps = {
  readonly env?: EdgeMainEnv;
};

function processEnvAdapter(): EdgeMainEnv {
  return {
    get(key: string): string | undefined {
      const value = process.env[key];
      return typeof value === 'string' ? value : undefined;
    },
  };
}

export function createEdgeMainUseCases(deps: EdgeMainUseCaseDeps = {}) {
  const env = deps.env ?? processEnvAdapter();

  return {
    publicActivationAuthorized: EDGE_MAIN_PUBLIC_ACTIVATION_AUTHORIZED,
    status: EDGE_MAIN_DISPATCHER_STATUS,
    workerMemoryLimitMb: EDGE_MAIN_WORKER_MEMORY_LIMIT_MB,
    workerTimeoutMs: EDGE_MAIN_WORKER_TIMEOUT_MS,
    legacyDefects: describeEdgeMainLegacyDefects(),
    dispatch: async (input: {
      readonly method: string;
      readonly pathname: string;
      readonly search?: string;
      readonly body?: unknown;
      readonly authorization?: string | null;
    }): Promise<EdgeMainDispatchResult> =>
      dispatchEdgeMainRequest({
        method: input.method,
        pathname: input.pathname,
        search: input.search,
        body: input.body,
        authorization: input.authorization,
        env,
      }),
    workerAuth: evaluatePostDispatcherWorkerAuth,
  };
}

export type EdgeMainUseCases = ReturnType<typeof createEdgeMainUseCases>;
