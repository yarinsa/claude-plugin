# Parallelism and suite performance

## The model

- **Worker** = an OS process running tests serially, each in a fresh `BrowserContext`.
- `fullyParallel: true` distributes individual tests across workers. Without it, files are the unit.
- **Shard** = a slice of the suite on a separate machine. Shards multiply across machines; workers multiply within one.

```ts
fullyParallel: true,
workers: process.env.CI ? 4 : 2,
```

Workers are CPU-bound - roughly one per core, minus headroom. Over-provisioning makes everything slower and produces timeout flakes that look like app bugs.

## Serial exceptions

```ts
test.describe.configure({ mode: 'serial' });     // ordered, later tests skip on failure
test.describe.configure({ mode: 'parallel' });   // opt in when the file default is serial
```

Serial mode hides breakage - a failure skips the rest, so you fix one bug and discover three more. Use it only for a genuine constraint (a single Storybook dev server, a non-reentrant backend), and write down why in the config.

## Sharding

See `infrastructure/ci-cd.md` for the workflow. Two rules:

- Setup projects run **once per shard**, not once per run. Anything globally destructive must be idempotent or shard-scoped (`test_${SHARD_INDEX}` schema).
- Playwright shards by file by default; a suite with one enormous file gets no benefit. Split it.

## Where the time actually goes

Measure before optimizing - `--reporter=list` prints per-test duration, and the HTML report sorts by it. Usual order of impact:

1. **UI-driven setup.** Logging in through the form in every test is almost always the top cost. Storage state plus API seeding removes it. This is the single biggest win available.
2. **Sleeps.** Grep for `waitForTimeout` and delete them.
3. **Over-broad E2E.** Tests that should be unit tests. Push down.
4. **Third-party requests.** Block analytics, chat widgets, and ad scripts - they add seconds and flakes.
5. **Unnecessary navigation.** Reuse the page across steps in one test rather than re-`goto`.

## Cheap global wins

```ts
await page.route(/analytics|sentry|intercom|hotjar|doubleclick/, (r) => r.abort());
```

```ts
video: process.env.CI ? 'off' : 'on',
trace: 'on-first-retry',
```

Always-on video and tracing can double runtime and produce gigabytes nobody opens.

Install only the browsers you run (`npx playwright install chromium`), and cache them keyed on the resolved Playwright version.

## Reusing setup safely

Worker-scoped fixtures amortize expensive setup across a worker's tests - but **only for immutable state**. A worker-scoped fixture that tests can write to is the classic "passes alone, fails in parallel" bug. If it is mutable, it is test-scoped.

## Timeouts

```ts
timeout: 30_000,
expect: { timeout: 15_000 },
globalTimeout: 30 * 60_000,
```

A per-job `timeout-minutes` in CI matters too - a hung E2E job otherwise burns the full runner limit.

## Budget

Keep the PR-blocking suite under about ten minutes wall clock. Past that, people stop reading it. Get there with tags (`@smoke` on PR, full suite nightly) and sharding, not by deleting coverage.
