import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : value && typeof value === 'object' ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
export const reportHash = (report) => createHash('sha256').update(canonical(report)).digest('hex');
const finite = (value, minimum = 0) => assert.ok(typeof value === 'number' && Number.isFinite(value) && value >= minimum);

// Validate recorded historical measurements; never demand timing equality with
// a new run. A report hash binds these observations to the precise source report.
export function validateObservation(report, observation) {
  assert.equal(observation.schemaVersion, 1);
  for (const key of ['gate', 'status', 'executedStatus']) assert.equal(observation[key], report[key]);
  assert.equal(observation.deterministicReportSha256, reportHash(report), 'observation/report hash mismatch');
  assert.ok(Number.isFinite(Date.parse(observation.runAt)), 'invalid observation timestamp');
  for (const key of ['node', 'os', 'architecture', 'kernel', 'sqlite']) assert.ok(typeof observation.runtime?.[key] === 'string' && observation.runtime[key].length > 0, `missing runtime ${key}`);
  if (report.executedStatus !== 'PASS') return; // Partial failed runs remain recordable and fail execution checks.
  const metrics = observation.metrics;
  if (report.gate === 'GATE-02') {
    assert.deepEqual(Object.keys(metrics).sort(), ['browser', 'cookieRevocation', 'jwtRevocation']);
    for (const kind of ['cookieRevocation', 'jwtRevocation']) {
      assert.deepEqual(metrics[kind].map((sample) => sample.operation), ['sign-out', 'revoke-session']);
      for (const sample of metrics[kind]) { finite(sample.endToEndMs, .001); assert.ok(sample.endToEndMs <= 2000, 'recorded revocation exceeds deadline'); }
    }
    assert.equal(metrics.browser.browser, 'chromium'); assert.ok(/^\d+\.\d+\.\d+\.\d+$/.test(metrics.browser.version));
    assert.equal(metrics.browser.httpOnly, true); assert.equal(metrics.browser.reusedUserProfile, false);
    return;
  }
  assert.deepEqual(Object.keys(metrics).sort(), ['honoCommands', 'honoConcurrentHttp', 'honoReconnects', 'minimalCommands', 'minimalConcurrentHttp', 'minimalReconnects']);
  for (const [name, metric] of Object.entries(metrics)) {
    assert.equal(metric.samples, 200); assert.equal(metric.errorRate, 0);
    const ordered = ['p50Ms', 'p95Ms', 'p99Ms', 'maxMs'].map((key) => metric[key]);
    ordered.forEach((value) => finite(value, .001));
    assert.deepEqual(ordered, [...ordered].sort((a, b) => a - b), `invalid percentiles ${name}`);
    if (name.endsWith('Commands')) {
      finite(metric.elapsedMs, .001); finite(metric.operationsPerSecond, .001);
      assert.ok(Math.abs(metric.operationsPerSecond - 200000 / metric.elapsedMs) < 1, 'throughput/elapsed inconsistency');
    } else { assert.equal(metric.attempts, 200); assert.equal(metric.succeeded, 200); }
    if (name.endsWith('ConcurrentHttp')) {
      finite(metric.overlapMs, .001);
      assert.ok(Number.isInteger(metric.httpAcksDuringReconnects) && metric.httpAcksDuringReconnects >= 0 && metric.httpAcksDuringReconnects <= 200);
      assert.ok(Number.isInteger(metric.reconnectsDuringHttp) && metric.reconnectsDuringHttp > 0 && metric.reconnectsDuringHttp <= 200, 'missing reconnect completions during HTTP workload');
    }
  }
}
