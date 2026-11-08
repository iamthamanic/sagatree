/**
 * main — Edge Runtime dispatcher for allowlisted supabase/functions/* workers.
 * Location: supabase/functions/main/index.ts
 *
 * Nginx may strip `/functions/v1`; workers still expect that prefix in pathname.
 * Always forward `/functions/v1/<function-name>/…` to the worker.
 *
 * #607: Enforce VERIFY_JWT here — stock edge-runtime JWT checks do not wrap
 * userWorkers created by this custom main.
 * #668: Deny-by-default allowlist — unknown / legacy mounts return 404 without
 * starting a worker (fail-closed AuthZ surface).
 */
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { isEdgeDispatcherAllowed } from '../_shared/edge-dispatcher-allowlist.ts';
import { gateEdgeRequestJwt } from '../_shared/edge-jwt-gate.ts';

declare const EdgeRuntime: {
  userWorkers: {
    create: (opts: {
      servicePath: string;
      memoryLimitMb?: number;
      workerTimeoutMs?: number;
      noModuleCache?: boolean;
      importMapPath?: string | null;
      envVars?: Array<[string, string]>;
    }) => Promise<{ fetch: (req: Request) => Promise<Response> }>;
  };
};

function resolveServiceName(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;
  if (segments[0] === 'functions' && segments[1] === 'v1') {
    return segments[2] ?? null;
  }
  return segments[0] ?? null;
}

/** Workers strip `/functions/v1/<name>`; restore that prefix after nginx strip. */
function toWorkerRequest(req: Request, serviceName: string): Request {
  const url = new URL(req.url);
  const segments = url.pathname.split('/').filter(Boolean);
  let afterService: string[];
  if (segments[0] === 'functions' && segments[1] === 'v1') {
    afterService = segments.slice(3);
  } else {
    afterService = segments.slice(1);
  }
  const suffix = afterService.length > 0 ? `/${afterService.join('/')}` : '';
  url.pathname = `/functions/v1/${serviceName}${suffix}`;
  return new Request(url.toString(), req);
}

console.log('SagaTree edge main dispatcher started');

serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const serviceName = resolveServiceName(url.pathname);

    if (!serviceName) {
      return new Response(JSON.stringify({ error: 'missing function name' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Fail closed before JWT / worker create — legacy mounts never start.
    if (!isEdgeDispatcherAllowed(serviceName)) {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const jwtDenied = await gateEdgeRequestJwt(req);
    if (jwtDenied) return jwtDenied;

    const servicePath = `/home/deno/functions/${serviceName}`;
    const envVarsObj = {
      ...Deno.env.toObject(),
      SUPABASE_FUNCTION_SLUG: serviceName,
    };
    const envVars = Object.entries(envVarsObj) as Array<[string, string]>;

    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      // Avatar Meshy materialize (GLB download/upload) needs headroom; 256MB OOM-kills the container.
      memoryLimitMb: 512,
      workerTimeoutMs: 5 * 60 * 1000,
      noModuleCache: false,
      importMapPath: '/home/deno/import_map.json',
      envVars,
    });

    return await worker.fetch(toWorkerRequest(req, serviceName));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('edge main dispatch failed', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
