# Network interception

## Register before navigation

```ts
await page.route('**/api/items', handler);
await page.goto('/items');            // order matters
```

A request already in flight is not intercepted. Most "my mock did nothing" reports are this.

## Handler forms

```ts
await route.fulfill({ status: 200, json: { items: [] } });     // `json` sets the content-type
await route.fulfill({ path: './fixtures/items.json' });
await route.abort('failed');                                    // network error
await route.abort('internetdisconnected');
await route.continue({ url, method, headers, postData });       // modify and pass through
await route.fallback();                                         // hand to the next matching handler
```

Handlers run **last-registered-first**. `route.fallback()` walks down the chain, so you can layer a broad default under a specific override:

```ts
await page.route('**/api/**', (r) => r.fulfill({ json: DEFAULTS }));       // broad
await page.route('**/api/user', (r) => r.fulfill({ json: ADMIN }));        // wins
```

## Modify instead of replace

```ts
await page.route('**/api/profile', async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  await route.fulfill({ json: { ...json, plan: 'enterprise' } });
});
```

Keeps the rest of the payload real, so contract drift still surfaces. Prefer this to a full hand-written fixture.

## Matching

```ts
page.route('**/api/items?*', h);                       // glob
page.route(/\/api\/items\/\d+$/, h);                   // regex
page.route((url) => url.pathname.startsWith('/api/'), h);   // predicate
```

Scope narrowly. `page.route('**/*')` intercepts every asset and slows the whole test.

## Sequenced responses

```ts
let call = 0;
await page.route('**/api/jobs', (route) =>
  route.fulfill({ json: { status: ++call < 3 ? 'running' : 'done' } }),
);
```

The standard way to test polling and eventual-consistency UI.

## Latency and loading states

```ts
await page.route('**/api/slow', async (route) => {
  await new Promise((r) => setTimeout(r, 3000));
  await route.fulfill({ json: {} });
});
```

The one legitimate use of a timer in tests - you are simulating the network, not waiting on the app.

## GraphQL

A single endpoint serves every operation, so match on the body:

```ts
await page.route('**/graphql', async (route) => {
  const { operationName } = route.request().postDataJSON();
  if (operationName === 'GetIntegrations') {
    return route.fulfill({ json: { data: { integrations: [] } } });
  }
  return route.fallback();
});
```

Always `fallback()` the unmatched operations, or you break every other query on the page. GraphQL errors return **HTTP 200** with an `errors` array - to test error handling, fulfill 200 with `{ errors: [{ message: '...' }] }`, not a 500.

## Asserting on requests

```ts
const [req] = await Promise.all([
  page.waitForRequest((r) => r.url().includes('/api/track') && r.method() === 'POST'),
  page.getByRole('button', { name: 'Save' }).click(),
]);
expect(req.postDataJSON()).toMatchObject({ event: 'saved' });
```

Start the wait **before** the action. Use this when the request is the subject; do not use it as a proxy for "the UI updated" - the response can land before render.

Assert a request did *not* fire by counting:

```ts
let count = 0;
page.on('request', (r) => r.url().includes('/analytics') && count++);
// ... act ...
expect(count).toBe(0);
```

## WebSockets

```ts
await page.routeWebSocket('wss://**/live', (ws) => {
  ws.onMessage((m) => m === 'ping' && ws.send('pong'));
});
```

## HAR

```ts
await page.routeFromHAR('./har/flow.har', { url: '**/api/**', update: false });
```

Record once with `update: true`, replay after. Good for read-only flows; poor for stateful ones. Re-record on a schedule.

## Cleanup

Routes are per-context and die with it. Remove one early with `page.unroute(pattern)` when a test needs the real endpoint after a mocked phase.
