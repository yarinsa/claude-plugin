# Global setup and project dependencies

## Prefer a setup *project* over `globalSetup`

```ts
projects: [
  { name: 'setup', testMatch: /global\.setup\.ts/ },
  { name: 'chromium', use: { storageState: '.auth/user.json' }, dependencies: ['setup'] },
],
```

```ts
// global.setup.ts
import { test as setup, expect } from '@playwright/test';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_USER!);
  await page.getByLabel('Password').fill(process.env.TEST_PASS!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: '.auth/user.json' });
});
```

A setup project beats the legacy `globalSetup` function because it:

- appears in the report as a named test, so a setup failure is legible instead of an opaque run abort;
- produces traces and screenshots on failure;
- can be retried;
- has access to fixtures (`page`, `request`, `baseURL`).

Reserve the `globalSetup` option for non-browser work that must happen before anything else - starting a container, running a migration.

## Teardown

```ts
{ name: 'setup', testMatch: /global\.setup\.ts/, teardown: 'cleanup' },
{ name: 'cleanup', testMatch: /global\.teardown\.ts/ },
```

`teardown` runs after every project depending on `setup` finishes, including on failure. This is where a shared seeded dataset gets dropped.

## Dependency graphs

```ts
projects: [
  { name: 'setup' },
  { name: 'api',     dependencies: ['setup'] },
  { name: 'e2e',     dependencies: ['setup'] },
  { name: 'visual',  dependencies: ['e2e'] },
],
```

Dependencies are a DAG - `api` and `e2e` run in parallel once `setup` completes. Keep the graph shallow; a deep chain serializes the run and destroys the benefit of sharding.

## Multiple roles

One setup test per role, one storage-state file per role, one project per role:

```ts
{ name: 'admin',  use: { storageState: '.auth/admin.json' },  dependencies: ['setup'] },
{ name: 'viewer', use: { storageState: '.auth/viewer.json' }, dependencies: ['setup'] },
```

Tests that need two roles simultaneously should create contexts explicitly instead - see `advanced/multi-context.md`.

## Storage-state hygiene

- Gitignore `.auth/`. It holds live session tokens.
- Sessions expire. Either re-run setup per CI run (cheap, preferred) or validate the state and refresh on failure.
- Do not commit a storage-state file as a "fixture". It is a credential, and it will rot.

## Interaction with sharding

Setup projects run **once per shard**, not once per run. Anything expensive or globally destructive (dropping a database, seeding a shared table) will run N times concurrently. Make setup either idempotent or shard-scoped:

```ts
const schema = `test_${process.env.SHARD_INDEX ?? 0}`;
```

This is the most common sharding bug: four shards racing to seed the same fixture rows.
