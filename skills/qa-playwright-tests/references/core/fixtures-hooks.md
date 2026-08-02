# Fixtures and hooks

## House position: fixtures over Page Object Model

Default to Playwright fixtures plus small local helper functions in the spec file. Reach for a Page Object only when a genuinely multi-page flow is reused across many specs and its API is stable.

Why:

- A POM is a second abstraction layer over an already-good API. `page.getByRole('button', { name: 'Save' })` needs no wrapper.
- POMs accumulate methods used by one test each, then rot.
- Fixtures compose and are dependency-injected per test; POMs must be manually constructed and threaded.
- Fixtures participate in setup *and* teardown. A POM has no teardown story.

A helper function local to the spec is almost always the right size:

```ts
const storyUrl = (extra?: string) =>
  `/iframe.html?id=${BASE}&viewMode=story${extra ? `&${extra}` : ''}`;

async function openLayersMenu(page: Page) {
  await page.getByRole('button', { name: 'Layers' }).click();
}
```

When three specs need it, move it to `tests/utils/`. That is the whole progression - there is no POM step.

## Custom fixtures

```ts
import { test as base } from '@playwright/test';

type Fixtures = {
  seededProject: { id: string; name: string };
};

export const test = base.extend<Fixtures>({
  seededProject: async ({ request }, use) => {
    const res = await request.post('/api/projects', { data: { name: `proj-${Date.now()}` } });
    const project = await res.json();
    await use(project);                       // test body runs here
    await request.delete(`/api/projects/${project.id}`);   // teardown
  },
});

export { expect } from '@playwright/test';
```

Everything before `use()` is setup, everything after is teardown - even if the test failed. Import `test` from your fixtures module, never from `@playwright/test`, in specs that need it.

Fixtures are **lazy**: a fixture is only constructed if the test destructures it. A twenty-fixture file costs nothing for a test that uses one.

## Scope

```ts
export const test = base.extend<{}, { adminToken: string }>({
  adminToken: [async ({}, use) => {
    const token = await mintToken();
    await use(token);
  }, { scope: 'worker' }],
});
```

- `test` scope (default) - fresh per test. The safe default.
- `worker` scope - shared across all tests in a worker process. Only for genuinely immutable, expensive setup (a login token, a seeded read-only dataset).

Worker-scoped mutable state is the classic source of "passes alone, fails in parallel". If tests can write to it, it must be test-scoped.

## Auto fixtures

```ts
failOnConsoleError: [async ({ page }, use) => {
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await use();
  expect(errors).toEqual([]);
}, { auto: true }],
```

`auto: true` runs for every test without being destructured. Ideal for cross-cutting invariants (no console errors, no unhandled rejections).

## Overriding built-ins

```ts
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route('**/analytics/**', (r) => r.abort());
    await use(page);
  },
});
```

Useful for blanket third-party blocking. Keep it narrow - an overridden `page` applies everywhere and becomes invisible magic.

## Hooks

- `beforeEach` - fine for a `goto` and shared arrange steps. Prefer a fixture when it needs teardown.
- `beforeAll` / `afterAll` - run once per **worker**, not once per file globally. State created here is shared by every test in that worker; treat it as read-only.
- Put the assertion in the test, never in the hook. A failing hook reports as a suite error with no useful attribution.

## Isolation rules

Each test gets a fresh `BrowserContext` - separate cookies, storage, and cache. Do not undo that:

- No module-level `let` mutated by tests.
- No shared fixed IDs. Generate per-test (`\`user-${test.info().parallelIndex}\``, or a UUID).
- Clean up what you create, in fixture teardown so it runs on failure too.
- Tests must pass in any order. Verify with `--repeat-each=5` and by running a single test in isolation.
