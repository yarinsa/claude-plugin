# Configuration

## Baseline

```ts
export default defineConfig({
  testDir: './tests/integration',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : 2,
  expect: { timeout: 15_000 },
  outputDir: '../../test-output/playwright/<project>/results',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'off' : 'on',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

Rationale for the non-obvious ones:

- `forbidOnly` in CI - a committed `test.only` silently reduces the suite to one test and reports green. This turns it into a failure.
- `retries: 0` locally - retries hide flakes from the person who introduced them.
- `trace: 'on-first-retry'` - full trace exactly when something failed, no cost on green runs.
- `video: 'off'` in CI - traces already contain screenshots and DOM snapshots; video is redundant weight.
- `outputDir` outside the project tree - keeps artifacts out of watchers, linters, and Nx/Turbo input hashing.

## `testMatch` as a suite selector

When one project holds several kinds of test, select by filename convention rather than by directory:

```ts
testMatch: '**/*.storybook.spec.ts',
```

That lets story-driven tests and app-driven tests coexist with different configs and different web servers.

## `webServer`

```ts
webServer: {
  command: 'npx vite preview',
  url: baseURL,
  reuseExistingServer: !process.env.CI,
  timeout: 180_000,
},
```

- Test the **built** artifact, not the dev server. Dev middleware, unminified timing, and HMR sockets all change behavior.
- `reuseExistingServer: !process.env.CI` - attach to your already-running server locally, always boot a clean one in CI.
- `url` (not `port`) so Playwright polls for real readiness.
- Raise `timeout` for slow builds - a Storybook cold start can exceed the 60s default.

Make it conditional when the suite can also target a deployment:

```ts
...(process.env.PLAYWRIGHT_BASE_URL ? {} : { webServer: { ... } }),
```

## Projects

Projects are for **matrixing** (browser, viewport, locale) and for **dependencies**:

```ts
projects: [
  { name: 'setup', testMatch: /global\.setup\.ts/ },
  { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: '.auth/user.json' }, dependencies: ['setup'] },
  { name: 'mobile', use: { ...devices['Pixel 7'] }, dependencies: ['setup'] },
],
```

`dependencies` guarantees `setup` completes before the others start, and its artifacts are available. Better than `globalSetup` because it appears in the report, produces traces, and can be retried.

Do not add Firefox and WebKit reflexively. Each triples runtime. Add an engine when you have shipped an engine-specific bug.

## Determinism knobs

```ts
use: { locale: 'en-US', timezoneId: 'UTC', colorScheme: 'dark' },
```

Unpinned, these differ between a developer laptop and a CI runner and produce failures nobody can reproduce.

## Reporters

Three modes selected by env - local HTML, CI shard blob, merge job HTML/JSON. See `infrastructure/ci-cd.md`.

## Typed env access

Read env once at the top of the config into named constants. Scattered `process.env.X` reads inside nested config objects are impossible to audit, and a typo silently yields `undefined` rather than an error.

## Global timeouts

```ts
timeout: 30_000,          // per test
expect: { timeout: 15_000 },
globalTimeout: 30 * 60_000,   // whole run, CI safety net
```

Prefer raising the global `expect.timeout` once over sprinkling per-assertion overrides.
