# Flaky tests

A flaky test is a bug report about your test, your app, or your environment. Retries are a reporting tool, not a fix.

## Confirm the flake

```bash
npx playwright test <file> --repeat-each=20 --workers=1     # is it flaky at all?
npx playwright test --repeat-each=5 --workers=4             # is it flaky only under parallelism?
npx playwright test <file> --grep "<title>"                 # does it pass alone but fail in the suite?
```

The three results discriminate the cause:

| Symptom | Cause |
|---|---|
| Fails alone, randomly | Race in the test or the app |
| Passes alone, fails in suite | Shared state / order dependency |
| Passes locally, fails in CI | Timing, viewport, locale, or missing env |
| Fails only with `--workers>1` | Shared backend data or a worker-scoped mutable fixture |

## The five causes, in frequency order

### 1. Snapshot assertions

```ts
expect(await el.textContent()).toBe('Done');    // reads once
await expect(el).toHaveText('Done');            // retries
```

By far the most common. See `core/assertions-waiting.md`.

### 2. Shared state between tests

Module-level `let`, worker-scoped mutable fixtures, fixed entity IDs, or tests that depend on execution order. Every test must create and destroy its own data. See `core/test-data.md`.

### 3. Sleeps

`waitForTimeout` passes on a fast machine and fails on a loaded CI runner. Wait for the condition instead.

### 4. Animations and layout shift

A click lands where the element *was*. Playwright's actionability check includes stability, but CSS transitions on an ancestor still move targets.

```ts
await expect(page.locator('.toast')).toHaveScreenshot({ animations: 'disabled' });
```

Kill them globally for the suite:

```ts
await page.addInitScript(() => {
  const s = document.createElement('style');
  s.textContent = `*,*::before,*::after{animation:none!important;transition:none!important}`;
  document.head.append(s);
});
```

### 5. Auto-refreshing UI

Polling lists, websockets, and toasts that expire mid-assertion. Freeze the data (`page.route` a fixed response) or assert on something that does not churn.

## Strict-mode intermittency

A locator that matches one element usually and two occasionally (a duplicate row, a lingering toast) throws only sometimes. Never fix this with `.first()` - scope the locator to its owning container.

## Diagnosing with the trace

`trace: 'on-first-retry'` plus `retries: 2` gives you a trace of the failing attempt only. Compare the before/after DOM snapshot at the failing action against a passing run - the difference is the race.

## Quarantine policy

Quarantine is a 48-hour measure, not a resting place:

1. `test.fixme` with a reason and an issue link.
2. Issue assigned to an owner with a due date.
3. If unfixed by the date, delete the test.

A quarantined test provides zero signal while implying coverage. Track flake rate per test in CI (the JSON report has retry counts) and treat a rising rate as a defect, not weather.

## Retry settings

```ts
retries: process.env.CI ? 2 : 0,
```

Zero locally: retries hide flakes from the author who introduced them. Two in CI: absorbs genuine infrastructure noise. If a test needs three retries, it is broken.

Do not raise global timeouts to mask flakiness. It converts a fast failure into a slow one.
