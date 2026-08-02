# GraphQL testing

## Errors arrive as HTTP 200

The single most important fact. A GraphQL failure is `200 OK` with an `errors` array:

```ts
const res = await request.post('/graphql', { data: { query, variables } });
expect(res.status()).toBe(200);
const body = await res.json();
expect(body.errors).toBeUndefined();     // assert this explicitly, always
expect(body.data.integrations).toHaveLength(3);
```

`expect(res.ok()).toBeTruthy()` passes on a completely failed query. Every GraphQL API test needs an explicit `errors` assertion, or it asserts nothing.

Partial success is real: `data` can be populated *and* `errors` non-empty when a nullable field resolver throws. Assert both.

## Mocking by operation name

One endpoint serves everything, so match on the body:

```ts
await page.route('**/graphql', async (route) => {
  const { operationName } = route.request().postDataJSON();

  if (operationName === 'GetIntegrations') {
    return route.fulfill({ json: { data: { integrations: [] } } });
  }
  return route.fallback();
});
```

`fallback()` on unmatched operations is mandatory. Without it, one mock breaks every other query on the page and you debug the wrong thing.

This requires named operations (`query GetIntegrations { … }`). If the app sends anonymous queries, match on a substring of the query text instead - and fix the app, since named operations matter for tracing and persisted queries too.

## Mocking an error

```ts
return route.fulfill({
  status: 200,
  json: { data: { integrations: null }, errors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN' } }] },
});
```

Status 200, not 500. Mocking a 500 tests the network-failure path, which is a *different* code path from GraphQL error handling - both are worth covering, and conflating them means one is untested.

## Assert on variables

```ts
const [req] = await Promise.all([
  page.waitForRequest((r) => r.url().includes('/graphql')
    && r.postDataJSON()?.operationName === 'SearchItems'),
  page.getByRole('searchbox').fill('acme'),
]);
expect(req.postDataJSON().variables).toMatchObject({ query: 'acme', first: 25 });
```

The right way to test that a filter, a paginator, or a debounce produces the correct query.

## Generated types for mock payloads

Type mock data with the same generated types the app uses:

```ts
const mock: GetIntegrationsQuery = { integrations: [{ __typename: 'Integration', id: '1', name: 'x' }] };
```

A schema change then fails typecheck instead of silently passing a stale mock. Include `__typename` - a normalizing cache (Apollo, urql) will not write the entity without it, and the UI renders empty for reasons that look nothing like the real cause.

## Schema-level checks

Contract assertions are cheap and catch breaking changes before the UI does:

```ts
test('environments returns [] not null when empty', async ({ request }) => {
  const body = await (await request.post('/graphql', { data: { query: Q, variables: { id } } })).json();
  expect(body.errors).toBeUndefined();
  expect(body.data.integration.environments).toEqual([]);
});
```

Empty-list-vs-null is worth an explicit test per connection field - it is the most common schema regression and it crashes clients that map over the result.

## Pagination

Assert cursor semantics directly: first page shape, `pageInfo.hasNextPage`, that the cursor advances, and that a stale cursor errors rather than silently returning page one.

## Subscriptions

Mock the transport (`routeWebSocket`, see `advanced/browser-apis.md`) rather than driving a real subscription server.
