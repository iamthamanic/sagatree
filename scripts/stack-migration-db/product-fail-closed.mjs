/**
 * Fail-closed gate for the isolated atlas product journey.
 * Red when Playwright exits nonzero, expected &lt; 3, or any skip/flaky count.
 * Used by product-run.mjs and proven by atlas-product-fail-closed.self-test.mjs.
 */
export function atlasProductReportFailsClosed({ playwrightExitCode, browser }) {
  const expected = Number(browser?.expected ?? 0);
  const skipped = Number(browser?.skipped ?? 0);
  const flaky = Number(browser?.flaky ?? 0);
  return playwrightExitCode !== 0 || expected < 3 || skipped > 0 || flaky > 0;
}
