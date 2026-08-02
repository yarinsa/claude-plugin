# Authentication

## Log in once, reuse the state

Never drive the login form in every test. Authenticate once in a setup project, save the storage state, and load it everywhere else.

```ts
// global.setup.ts
setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.TEST_USER!);
  await page.getByLabel('Password').fill(process.env.TEST_PASS!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.context().storageState({ path: '.auth/user.json' });
});
```

```ts
{ name: 'chromium', use: { storageState: '.auth/user.json' }, dependencies: ['setup'] },
```

Assert a post-login element before saving. Otherwise a failed login silently writes an unauthenticated state file and every downstream test fails confusingly.

Keep exactly one test that exercises the real login form. That is the only place the form should be typed into.

## Injecting state directly

When the session is a cookie plus a flag in local storage, you can skip the browser round trip entirely and construct the state:

```ts
const devAuthCookies = (() => {
  if (!process.env.PLAYWRIGHT_BASE_URL) return [];
  try {
    return JSON.parse(fs.readFileSync('./tests/auth.json', 'utf-8')).cookies ?? [];
  } catch { return []; }
})();

use: {
  storageState: {
    cookies: devAuthCookies,
    origins: [{
      origin: baseURL,
      localStorage: [{ name: 'hasAuthenticationSession', value: 'true' }],
    }],
  },
},
```

Note the conditional: local runs against a dev server need no cookies, runs against a deployed environment do. Failing soft to `[]` is correct here - it degrades to "unauthenticated", which fails loudly in the test rather than crashing config load.

Same technique pins **feature flags**, which is often the higher-value use. Seeding the flag provider's persistence key makes flag-dependent UI deterministic instead of depending on what the remote service returns that day:

```ts
localStorage: [{ name: 'ph_<key>', value: JSON.stringify({
  $active_feature_flags: Object.keys(flags),
  $enabled_feature_flags: flags,
  $override_feature_flags: flags,
  distinct_id: 'test-user',
}) }],
```

## Multiple roles

One setup test and one state file per role, one project per role. For two roles **in the same test**, create contexts explicitly - see `advanced/multi-context.md`.

## Token-based APIs

```ts
adminToken: [async ({ request }, use) => {
  const res = await request.post('/api/token', { data: { user: 'admin', pass: process.env.PASS } });
  await use((await res.json()).token);
}, { scope: 'worker' }],
```

Worker scope is safe here only because the token is immutable and read-only.

For a bearer token the app reads from storage, `addInitScript` runs before any page script:

```ts
await context.addInitScript((t) => localStorage.setItem('token', t), token);
```

## Complex flows

- **MFA** - use a test account with a known TOTP secret and generate the code (`otplib`), or a backend bypass for test users. Never a hardcoded live code.
- **OAuth / SSO** - prefer a test IdP or a stubbed callback. Real Google/Okta login in CI is a permanent flake source and will trip bot detection. If you must, see `advanced/multi-context.md` for popup handling.
- **Magic link / password reset** - fetch the token from a mail-catcher API (Mailpit, Mailhog) or a backend test endpoint. Do not poll a real inbox.

## Hygiene

- Gitignore `.auth/`. Those are live sessions.
- Credentials come from CI secrets, never from committed files.
- Storage state expires - regenerate per run rather than caching across runs.
- Never point an authenticated E2E suite at production.
