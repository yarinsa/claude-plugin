# Reporting, artifacts, coverage

## Reporter selection by environment

```ts
reporter: process.env.PW_MERGE_REPORTS
  ? [['github'], ['json', { outputFile: '…/results.json' }], ['html', { outputFolder: '…/html-report', open: 'never' }]]
  : process.env.CI
    ? [['github'], ['blob', { outputDir: '…/blob-report' }]]
    : [['html', { outputFolder: '…/html-report' }]],
```

- `html` - the primary human artifact: traces, screenshots, steps, attachments.
- `blob` - the mergeable format for sharded runs. See `infrastructure/ci-cd.md`.
- `github` - inline PR annotations on the failing source line. The highest-signal-per-effort reporter in CI.
- `json` - machine-readable, for flake dashboards.
- `list` - readable local streaming output.
- `line` - compact; good for very large suites.

`open: 'never'` matters in the merge job - the default tries to open a browser on a headless runner.

## Artifacts

```ts
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: process.env.CI ? 'off' : 'on',
},
outputDir: '../../test-output/playwright/<project>/results',
```

Keep `outputDir` outside the project tree so artifacts stay out of watchers, linters, and Nx/Turbo input hashing.

Retention: blob artifacts are intermediate (`retention-days: 1`); the merged HTML report is what people open (7+ days).

Upload with `if: ${{ !cancelled() }}`. The default `success()` skips report generation exactly when tests failed.

## Custom attachments

```ts
await testInfo.attach('api-response', { body: JSON.stringify(payload, null, 2), contentType: 'application/json' });
await testInfo.attach('dom', { body: await page.content(), contentType: 'text/html' });
```

Attachments land in the HTML report next to the failure and survive the runner being destroyed - far better than `console.log` in CI output.

## Tracking flakes

The JSON report records retry counts. Persist it per run and track flake rate per test over time. A test's flake rate rising is a defect signal; without the trend you rediscover the same flake every month.

Fail the build on a flake-rate threshold once the suite is healthy - otherwise "flaky but passing" becomes permanent.

## Code coverage

Playwright is not a coverage tool, but Chromium can collect V8 coverage:

```ts
await page.coverage.startJSCoverage();
await page.goto('/');
const entries = await page.coverage.stopJSCoverage();
```

Convert with `v8-to-istanbul` and merge with unit coverage via `nyc`. Chromium only, and source maps must be available or the output is unreadable.

Treat E2E coverage as **exploratory**, not a gate. Two reasons: numbers are inflated by module-load side effects, and gating on E2E coverage pushes people to write slow E2E tests to hit a number - the opposite of the layering in `architecture/test-architecture.md`. Gate unit coverage instead.

The useful signal from E2E coverage is the inverse: large files with **zero** coverage across the whole suite are dead-code candidates.

## Publishing

Publish the merged HTML report as a PR comment or a hosted link. A report nobody can reach means every failure gets debugged by re-running locally, which is the slowest possible loop.
