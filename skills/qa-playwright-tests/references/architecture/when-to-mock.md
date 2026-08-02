# When to mock

## Default: real backend for E2E, mocks for edge cases

The point of E2E is integration. A suite that mocks every response is an expensive way to test your mocks - it passes while the real contract is broken.

**Use the real backend for** the happy path, auth, persistence, and anything where a contract change should fail the test.

**Mock for** what the real backend cannot give you reliably:

- Error states - 500, 429, malformed payload, partial failure.
- Slow responses and loading states.
- Third-party services - payments, email, SMS, OAuth providers, maps.
- Non-deterministic data where the assertion needs an exact value.
- Rare states - empty, one item, ten thousand items, pagination boundaries.

## Route interception

```ts
await page.route('**/api/items', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }),
);
```

Register routes **before** `goto` - a request already in flight is not intercepted. This is the most common mocking bug.

Modify rather than replace when you only need one field changed:

```ts
await page.route('**/api/profile', async (route) => {
  const res = await route.fetch();
  const json = await res.json();
  await route.fulfill({ json: { ...json, plan: 'enterprise' } });
});
```

This keeps the rest of the payload real, so a contract change still surfaces.

Other verbs:

```ts
await route.abort('failed');                  // network error
await route.continue({ headers: { ...route.request().headers(), 'x-test': '1' } });
await route.fulfill({ status: 429, headers: { 'retry-after': '30' } });
```

Scope narrowly. `page.route('**/*')` intercepts assets too and slows everything down.

## Contract drift is the real risk

A mock is a copy of a contract, and copies rot. Mitigations, in order of value:

1. **Generate mock payloads from the schema** (OpenAPI, GraphQL introspection, protobuf) rather than hand-writing JSON.
2. Keep at least one **unmocked** test per endpoint you mock, so the shape is still exercised.
3. Type mock payloads with the same generated types the app uses - a schema change then fails typecheck.

An untyped hand-written JSON fixture is the worst case: it silently diverges and the test keeps passing.

## HAR record and replay

```ts
await page.routeFromHAR('./har/checkout.har', { url: '**/api/**', update: false });
```

Record once against the real backend (`update: true`), replay deterministically after. Good for a complex read-only flow with many calls; poor for anything stateful. Re-record on a schedule or the HAR becomes a fossil.

## Blocking third parties

```ts
await page.route(/analytics|sentry|intercom|doubleclick/, (r) => r.abort());
```

Worth doing suite-wide in an overridden `page` fixture. Removes a class of flakiness and speeds every test up.

## What not to mock

- Your own database, in a test whose purpose is persistence.
- Auth, in an auth test. Mock auth *state* for other tests (see `advanced/authentication.md`), never in the test that covers login.
- Anything where the mock would encode the same assumption the code under test makes. That test asserts nothing.
