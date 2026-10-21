/**
 * Health use-case — readiness projection without secrets.
 * Location: server/src/application/health/index.ts
 */
import type { OpsPorts } from '../../modules/ops/index.ts';

export type HealthResult = {
  readonly ready: boolean;
  readonly mode: 'solo';
  readonly dataDirFingerprint: string;
};

export function createHealthUseCase(ops: OpsPorts) {
  return {
    execute(): HealthResult {
      const health = ops.getHealth();
      return {
        ready: health.ready,
        mode: health.mode,
        dataDirFingerprint: health.dataDirFingerprint,
      };
    },
  };
}
