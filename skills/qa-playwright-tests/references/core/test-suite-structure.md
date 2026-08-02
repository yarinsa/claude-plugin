# Test suite structure

## Layout

Mirror the product's feature boundaries, not the framework's file types:

```
tests/integration/
  auth/
  dashboard/
  inventory/
  settings/
  fixtures/      # custom test fixtures
  utils/         # shared helpers, promoted from specs
  pages/         # only if a real POM proved necessary
```

One directory per feature area. A newcomer asking "where are the billing tests" should not have to grep.

## Naming

- File: `<subject>.spec.ts`, or `<subject>.storybook.spec.ts` when the target is a story rather than the app. A `testMatch` glob can then select a whole class of tests.
- `describe`: the unit under test - `'URL sync'`, not `'tests'`.
- Test title: the assertion in plain English, including the condition. `'clearing isolation removes the g param entirely'` beats `'test url'`. Titles are what you read in a CI failure list.

Add a regression marker when a test exists because of a specific bug: `'default load has no g param at all (clearOnDefault regression)'`. It tells the next person not to "simplify" it away.

## File-level docblock

For any spec with non-obvious setup, put the contract at the top:

```ts
/**
 * URL sync - driven via the FullFeatured playground story.
 *
 * Param key: `g`. Format: g=selected=<id>;layout=<key>;hidden=<csv>
 * throttleMs: 100 - wait at least 200ms after a state change before checking the URL.
 * Node IDs (11 total): o1, dv1, a1, a2, a3, t1, t2, t3, d1, d2, al1.
 */
```

This is the highest-value comment in a test suite. It explains magic numbers (`toHaveCount(11)`), documents timing constants that justify a `waitForTimeout`, and saves the next reader from reverse-engineering the fixture data.

## Shape of a test

Arrange, act, assert - visibly separated. One behavior per test.

```ts
test('hiding a layer removes its nodes', async ({ page }) => {
  await page.goto(storyUrl());
  await expect(page.locator('.react-flow__node')).toHaveCount(11);

  await page.getByRole('button', { name: 'Layers' }).click();
  await page.getByRole('menuitem', { name: 'Agents' }).click();
  await page.keyboard.press('Escape');

  await expect(page.locator('.react-flow__node')).toHaveCount(8);
});
```

"One behavior" is not "one assertion". Several assertions describing a single outcome are fine. A test that logs in, edits, exports, and deletes is four tests.

## Independence

Every test must run standalone and in any order. No test may depend on a predecessor's side effects. When a flow genuinely has steps, either replay the setup via API (fast) or accept one longer test that owns the whole journey - never a chain of order-dependent tests.

## `test.step`

```ts
await test.step('apply the severity filter', async () => { ... });
```

Groups actions in the HTML report and trace viewer. Worth it for long flows; noise for a five-line test.

## Parallelism

`fullyParallel: true` is the target - every test independent, workers scaled to the runner. Drop to `workers: 1` only for a genuine constraint (a single shared Storybook instance, a non-reentrant backend), and write down why in the config:

```ts
/** Storybook only. Single worker: one dev server instance. */
fullyParallel: false,
workers: 1,
```

Use `test.describe.configure({ mode: 'serial' })` sparingly - a failure in a serial block skips the rest, hiding subsequent breakage.

## What belongs in E2E

E2E is the most expensive, slowest, flakiest layer. Reserve it for behavior that only emerges from real integration: routing, auth, cross-component state, URL sync, third-party embeds.

Push down aggressively - validation rules, formatting, and reducer logic belong in unit tests. A 400-test E2E suite that duplicates unit coverage is a permanent tax on every PR.
