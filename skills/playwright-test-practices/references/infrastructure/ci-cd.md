# CI/CD for E2E

The reference shape: a reusable workflow, a sharded matrix that produces blob reports, and a second job that merges them into one HTML report. Everything below assumes GitHub Actions; the structure ports to GitLab/CircleCI unchanged.

## Reusable workflow, parameterized by app

In a monorepo, do not copy the E2E job per app. Expose it via `workflow_call` and pass the app name:

```yaml
on:
  workflow_call:
    inputs:
      APP_NAME:
        required: true
        type: string

env:
  SHARD_TOTAL: 4
```

Callers become one line, and a fix to the E2E pipeline lands everywhere at once.

## Shard the run

```yaml
strategy:
  fail-fast: false
  matrix:
    shard: [1, 2, 3, 4]
```

```yaml
- run: npx playwright test --shard=${{ matrix.shard }}/${{ env.SHARD_TOTAL }}
```

- `fail-fast: false` is mandatory. Otherwise the first failing shard cancels the others and you see one failure instead of all of them.
- Keep `SHARD_TOTAL` in `env` so the matrix and the `--shard` denominator cannot drift apart.
- Set a `timeout-minutes` on the job. An E2E job that hangs otherwise burns the full runner limit.

## Cache browsers, keyed on the resolved version

Browser binaries are the slowest install step. Key the cache on the *actual resolved* Playwright version, not the lockfile hash - the binaries change with the Playwright release, nothing else:

```yaml
- name: Resolve Playwright version
  id: pw
  run: echo "version=$(node -e "console.log(require('@playwright/test/package.json').version)")" >> "$GITHUB_OUTPUT"

- uses: actions/cache@<sha>
  id: pw-cache
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ steps.pw.outputs.version }}

- if: steps.pw-cache.outputs.cache-hit != 'true'
  run: npx playwright install chromium --with-deps

- if: steps.pw-cache.outputs.cache-hit == 'true'
  run: npx playwright install-deps chromium
```

The two-branch install is the part people miss: the cache restores the *browsers* but not the apt-level **system** libraries, which live outside `~/.cache/ms-playwright`. On a cache hit you still need `install-deps`, or Chromium fails to launch with a missing-shared-object error.

Install only the browsers you actually run. `npx playwright install` with no argument pulls all three engines.

## Blob reports + merge

With sharding, each shard produces a partial report. Emit `blob` in CI and merge afterwards:

```ts
reporter: process.env.PW_MERGE_REPORTS
  ? [['github'], ['json', { outputFile: '…/results.json' }], ['html', { outputFolder: '…/html-report', open: 'never' }]]
  : process.env.CI
    ? [['github'], ['blob', { outputDir: '…/blob-report' }]]
    : [['html', { outputFolder: '…/html-report' }]],
```

Three modes, selected by env:

- **local** - HTML, opens on failure.
- **CI shard** - `github` (inline PR annotations on the failing line) + `blob` (mergeable artifact).
- **merge job** - `PW_MERGE_REPORTS=1` switches to the final HTML/JSON output.

Upload each shard's blob, then merge in a dependent job:

```yaml
- uses: actions/upload-artifact@<sha>
  if: ${{ !cancelled() }}
  with:
    name: blob-report-${{ inputs.APP_NAME }}-${{ matrix.shard }}
    path: …/blob-report/
    retention-days: 1
```

```yaml
merge-reports:
  needs: integration-tests
  if: ${{ !cancelled() }}
  steps:
    - uses: actions/download-artifact@<sha>
      with:
        path: all-blob-reports
        pattern: blob-report-${{ inputs.APP_NAME }}-*
        merge-multiple: true
    - env:
        PW_MERGE_REPORTS: '1'
      run: npx playwright merge-reports --config <app>/playwright.config.ts all-blob-reports
```

- `if: ${{ !cancelled() }}` on both the upload and the merge job. The default `success()` would skip report generation exactly when tests failed - i.e. when you need the report.
- Blob artifacts get `retention-days: 1` (intermediate); the merged HTML report gets 7+.

## Config that must differ in CI

```ts
forbidOnly: !!process.env.CI,          // a stray test.only must fail the build
retries: process.env.CI ? 2 : 0,       // never retry locally - you would not see the flake
workers: process.env.CI ? 4 : 2,
trace: 'on-first-retry',               // trace only the retry: near-zero cost on green runs
screenshot: 'only-on-failure',
video: process.env.CI ? 'off' : 'on',
```

`trace: 'on-first-retry'` is the right default. `trace: 'on'` slows every test and produces gigabytes of artifacts nobody opens.

## Supply chain

Pin every third-party action to a full commit SHA with the version in a trailing comment, and set `persist-credentials: false` on checkout so the job's `GITHUB_TOKEN` is not left in `.git/config` for later steps to exfiltrate:

```yaml
- uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6.0.2
  with:
    persist-credentials: false
```

Never interpolate `${{ inputs.X }}` directly into a `run:` shell line - route it through `env:` and reference `"$INPUTS_X"` quoted. Direct interpolation is a script-injection sink.

## Memory

Browser-heavy suites OOM the default Node heap on standard runners:

```yaml
env:
  NODE_OPTIONS: --max-old-space-size=6144
```

## Running against a deployed environment

Let the base URL switch the config between "boot a local preview server" and "hit a real deployment":

```ts
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173';

...(process.env.PLAYWRIGHT_BASE_URL ? {} : {
  webServer: { command: 'npx vite preview', url: baseURL, reuseExistingServer: !process.env.CI },
}),
```

Test the built artifact (`vite preview`), not the dev server - dev-only middleware, unminified timing, and HMR sockets all change behavior.

## Only run what changed

In a monorepo, gate E2E on affected projects (`nx affected`, Turbo filters, or a `paths:` trigger). A full E2E sweep on a README change trains everyone to ignore CI.
