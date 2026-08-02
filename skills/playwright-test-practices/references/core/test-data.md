# Test data

## Every test owns its data

Shared mutable fixture data is the root cause of parallel flakiness. Each test creates what it needs and removes it in teardown.

```ts
seededInvoice: async ({ request }, use, testInfo) => {
  const ref = `inv-${testInfo.parallelIndex}-${testInfo.repeatEachIndex}-${testInfo.title.slice(0, 8)}`;
  const invoice = await createInvoice(request, { ref });
  await use(invoice);
  await deleteInvoice(request, invoice.id);
},
```

Derive uniqueness from `testInfo.parallelIndex` (worker slot) rather than a random value where you can - it stays stable across `--repeat-each` and makes leaked rows traceable to a worker.

## Seed via API, assert via UI

Never drive the UI to reach a precondition. Logging in through the form to test the settings page makes the settings test fail whenever login breaks, and costs seconds per test.

```ts
test('renames a project', async ({ page, request }) => {
  const project = await api.createProject(request, { name: 'before' });   // arrange: API
  await page.goto(`/projects/${project.id}`);                             // act: UI
  await page.getByRole('textbox', { name: 'Name' }).fill('after');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'after' })).toBeVisible();
});
```

## Factories, not fixtures files

```ts
export const makeUser = (over: Partial<User> = {}): User => ({
  id: crypto.randomUUID(),
  name: 'Test User',
  role: 'viewer',
  createdAt: '2024-01-01T00:00:00Z',
  ...over,
});
```

A factory with sane defaults and an override bag beats a directory of near-identical JSON files. The test states only what it cares about:

```ts
const admin = makeUser({ role: 'admin' });
```

That override *is* the documentation of what the test depends on.

## Determinism

Anything non-deterministic must be pinned or the test will fail eventually.

- **Dates** - never `new Date()` in expectations. Use fixed ISO strings in factories, and `page.clock` for anything the app reads from the wall clock.
- **Ordering** - do not assume the API returns rows in insertion order. Assert with `toHaveText([...])` against an explicitly sorted view, or sort in the assertion.
- **Locale/timezone** - pin in the config, or a test that passes in CI (UTC) fails on a developer machine:

```ts
use: { locale: 'en-US', timezoneId: 'UTC' },
```

- **Randomness** - if the app seeds from `Math.random`, stub it via `addInitScript`.

## Cleanup

Cleanup goes in fixture teardown (after `use()`), never at the end of the test body - a failing test never reaches its last line, and the leaked row poisons the next run.

Make deletes idempotent and tolerate a 404: the test may have already removed the entity as part of what it was asserting.

For suites against a long-lived shared environment, add a periodic sweep of anything matching the test-data prefix older than a day. Teardown will miss rows when a runner is killed.

## Storage state as data

Auth and feature-flag state can be injected directly rather than clicked through:

```ts
use: {
  storageState: {
    cookies: devAuthCookies,
    origins: [{
      origin: baseURL,
      localStorage: [
        { name: 'hasAuthenticationSession', value: 'true' },
        { name: 'ph_test', value: JSON.stringify(flagState) },
      ],
    }],
  },
},
```

This makes flag-dependent UI deterministic instead of depending on what the remote flag service returns that day. See `advanced/authentication.md`.

## Never point E2E at production

Test data creation implies write access. Use an ephemeral or dedicated environment, and make the base URL explicit rather than defaulted.
