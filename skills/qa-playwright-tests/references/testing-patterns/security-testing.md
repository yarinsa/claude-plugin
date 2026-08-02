# Security testing

E2E security tests cover a narrow but valuable band: authorization, injection reflection, and header/cookie hygiene. They do not replace SAST, dependency scanning, or a pentest.

Only run these against systems you are authorized to test. Never against production.

## Authorization is the highest-value case

Most real breaches are broken access control, not exotic injection.

```ts
for (const [role, expected] of [['admin', 200], ['viewer', 403], ['anon', 401]] as const) {
  test(`DELETE /projects/:id as ${role}`, async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: stateFor(role) });
    expect((await ctx.delete(`/api/projects/${id}`)).status()).toBe(expected);
    await ctx.dispose();
  });
}
```

Cover explicitly:

- **IDOR** - authenticate as user A, request user B's resource by ID directly.
- **Cross-tenant** - one test per resource type. A tenant-scoped query that leaks another tenant's rows is invisible in the UI.
- **Hidden ≠ forbidden** - a button hidden in the UI proves nothing. Call the endpoint directly.
- **Privilege escalation via mass assignment** - `PATCH /users/me` with `{ role: 'admin' }`.

```ts
test('viewer cannot escalate via profile update', async ({ request }) => {
  await request.patch('/api/users/me', { data: { role: 'admin' }, headers: viewerAuth });
  expect((await request.get('/api/users/me', { headers: viewerAuth })).json()).toMatchObject({ role: 'viewer' });
});
```

## XSS reflection

```ts
const payload = '<img src=x onerror="window.__x=1">';
await page.getByLabel('Display name').fill(payload);
await page.getByRole('button', { name: 'Save' }).click();
await page.reload();

expect(await page.evaluate(() => (window as never as { __x?: number }).__x)).toBeUndefined();
await expect(page.getByText(payload)).toBeVisible();   // rendered as literal text
```

Two assertions: the script did not execute, **and** the value round-tripped as text. Checking only the first passes when the field silently drops input.

Cover stored (persisted, other user's view), reflected (query param), and DOM-based (hash fragment) separately - different code paths.

## CSRF

```ts
const res = await request.post('/api/transfer', {
  data: { to: 'attacker', amount: 100 },
  headers: { cookie: sessionCookie },        // cookie present, CSRF token absent
});
expect(res.status()).toBe(403);
```

Also assert the session cookie's flags:

```ts
const c = (await context.cookies()).find((x) => x.name === 'session')!;
expect(c.httpOnly).toBe(true);
expect(c.secure).toBe(true);
expect(c.sameSite).toBe('Lax');
```

`httpOnly` is the one that makes an XSS non-catastrophic.

## Headers

```ts
const h = (await request.get('/')).headers();
expect(h['content-security-policy']).toBeTruthy();
expect(h['x-content-type-options']).toBe('nosniff');
expect(h['strict-transport-security']).toContain('max-age=');
expect(h['x-powered-by']).toBeUndefined();
```

Cheap, stable, and catches a whole class of misconfiguration on deploy.

## Session lifecycle

- Logout invalidates the token server-side (replay the old token, expect 401) - not just clears it client-side.
- Session fixation: the session ID changes on login.
- Expiry enforced server-side (`advanced/clock-mocking.md` for the UI half).

## Injection beyond XSS

Send SQL/NoSQL/template metacharacters and assert a clean 400/422 with **no** stack trace, driver error, or query fragment in the body. Leaked error detail is the finding, more often than the injection itself.

## Redirects

```ts
await page.goto('/login?next=https://evil.example');
await login(page);
expect(new URL(page.url()).origin).toBe(new URL(baseURL).origin);
```
