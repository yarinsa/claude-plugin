# API testing

## The `request` fixture

```ts
test('creates a project', async ({ request }) => {
  const res = await request.post('/api/projects', { data: { name: 'x' } });
  expect(res.status()).toBe(201);
  expect(await res.json()).toMatchObject({ name: 'x', id: expect.any(String) });
});
```

`request` shares cookies and `storageState` with the browser context, so an authenticated UI session authenticates API calls too. `request.newContext()` gives an isolated client when you need different credentials.

No browser is launched for a pure API test - these run in milliseconds. Put them in their own project (`*.api.spec.ts`) with no `webServer` browser dependency.

## Where API tests earn their place

- Contract shape and status codes.
- **Authorization** - the highest-value API tests. Every endpoint, every role, plus cross-tenant access.
- Validation and error payloads.
- Seeding and cleanup for UI tests (see `core/test-data.md`).

## Authorization is the case worth being exhaustive about

```ts
for (const [role, expected] of [['admin', 200], ['viewer', 403], ['anon', 401]] as const) {
  test(`DELETE /projects/:id as ${role} -> ${expected}`, async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ storageState: stateFor(role) });
    expect((await ctx.delete(`/api/projects/${id}`)).status()).toBe(expected);
    await ctx.dispose();
  });
}
```

Cross-tenant leakage deserves an explicit test per resource - a tenant-scoped query that silently returns another tenant's rows is a security bug that no UI test will catch:

```ts
test('tenant A cannot read tenant B resources', async ({ request }) => {
  const res = await request.get(`/api/projects/${tenantBProjectId}`, { headers: tenantAAuth });
  expect([403, 404]).toContain(res.status());
});
```

404 and 403 are both acceptable; leaking existence via 403-vs-404 is itself a decision to make deliberately.

## Assertions

```ts
expect(res.ok()).toBeTruthy();
expect(res.status()).toBe(422);
expect(res.headers()['content-type']).toContain('application/json');
expect(await res.json()).toMatchObject({ errors: [{ field: 'email' }] });
```

`toMatchObject` over `toEqual` - it asserts what the test cares about and does not break when an unrelated field is added.

Validate the shape, not a snapshot of the whole payload. A whole-payload snapshot fails on every additive change and trains people to re-record it blindly.

## Error paths

Status codes are the cheapest high-value coverage and are almost always under-tested: 400 malformed body, 401 missing token, 403 wrong role, 404 missing resource, 409 conflict, 422 validation, 429 rate limit.

## Options

```ts
await request.post('/api/x', {
  data: { a: 1 },                        // JSON
  form: { a: '1' },                      // urlencoded
  multipart: { file: { name: 'a.txt', mimeType: 'text/plain', buffer } },
  headers: { authorization: `Bearer ${token}` },
  params: { page: 2 },
  failOnStatusCode: false,               // default - non-2xx does NOT throw
  timeout: 10_000,
});
```

Non-2xx does not throw by default, which is what you want when asserting error codes.

## Mixing API and UI

Seed via API, act via UI, and verify via API when the UI cannot show the whole truth:

```ts
const project = await api.create(request, { name: 'before' });
await page.goto(`/projects/${project.id}`);
await rename(page, 'after');
await expect(page.getByRole('heading', { name: 'after' })).toBeVisible();
expect((await api.get(request, project.id)).name).toBe('after');   // persisted, not just rendered
```

That last line is the difference between "the UI updated optimistically" and "the change was saved".
