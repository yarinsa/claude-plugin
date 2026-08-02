# Annotations and tags

## Annotations

```ts
test.skip(...)                  // never runs - environment or platform does not apply
test.fixme(...)                 // known broken, do not run, must be fixed
test.fail(...)                  // asserts the test currently FAILS; fails if it passes
test.slow()                     // triples the timeout
```

Semantics matter for triage:

- `skip` - "this does not apply here" (wrong browser, feature absent in this environment).
- `fixme` - "this is a bug we own". Grep-able backlog. Always leave a reason and an issue link.
- `fail` - "known broken, and I want CI to tell me the moment it starts passing." Strictly better than `fixme` for a bug with a pending fix, because it self-cleans.

Always pass a reason - it renders in the report:

```ts
test.fixme(true, 'Flaky under parallel load - see #4821');
```

### Conditional

```ts
test.skip(({ browserName }) => browserName === 'webkit', 'clipboard API unsupported');
test.skip(!!process.env.CI, 'requires a local GPU');
```

Prefer the callback form over an `if` in the body - the report shows it as skipped rather than passed.

### Runtime annotations

```ts
test.info().annotations.push({ type: 'issue', description: 'https://…/4821' });
```

Surfaces in the HTML report and JSON output; useful for linking a test to a ticket without polluting the title.

## Tags

Tag in the title array (modern) rather than in the title string:

```ts
test('checkout succeeds', { tag: ['@smoke', '@critical'] }, async ({ page }) => { ... });
test.describe('billing', { tag: '@slow' }, () => { ... });
```

Filter:

```bash
npx playwright test --grep @smoke
npx playwright test --grep-invert @slow
npx playwright test --grep "@smoke|@critical"
```

### A tag vocabulary that stays useful

Keep it small and orthogonal. Three axes is usually enough:

- **Gate** - `@smoke` (PR-blocking, <2 min), `@full` (merge queue / nightly).
- **Risk** - `@critical` for revenue or auth paths; used to decide what gets extra retries and what pages an on-call.
- **Cost** - `@slow` for anything you would exclude from the fast loop.

Do not tag by feature area - that is what the directory structure is for, and `--grep` on a path works already.

### Wiring tags to CI

```yaml
# PR
- run: npx playwright test --grep @smoke
# nightly
- run: npx playwright test
```

The value of tags is entirely in this split. A tag vocabulary nothing filters on is dead weight.

## `test.step`

```ts
await test.step('seed the account', async () => { ... });
```

Nests actions in the report and trace. Use for long flows; skip for short tests.

## Anti-patterns

- A `skip` with no reason - nobody can tell whether it is obsolete or load-bearing.
- Permanent `fixme` on a test that has been broken for a year. Either fix it or delete it; a quarantined test provides zero signal while implying coverage.
- Tags in the title string (`test('@smoke checkout')`) - pollutes report titles and breaks exact-title filtering.
- Tagging every test. If everything is `@critical`, nothing is.
