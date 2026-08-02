# Error states and edge cases

Error paths are where the bugs are, and they are the least-tested part of most suites. They are also the easiest to test, because interception makes every failure reproducible on demand.

## HTTP failures

```ts
for (const status of [400, 401, 403, 404, 429, 500, 503]) {
  test(`shows an error for ${status}`, async ({ page }) => {
    await page.route('**/api/items', (r) => r.fulfill({ status, json: { message: 'nope' } }));
    await page.goto('/items');
    await expect(page.getByRole('alert')).toBeVisible();
  });
}
```

Then assert they are handled *differently* where they should be - 401 redirects to login, 403 shows a permissions message, 429 shows a retry hint, 500 offers a retry action. Collapsing all of them into one generic banner is the defect this test surfaces.

## Network-level failures

```ts
await page.route('**/api/**', (r) => r.abort('failed'));                 // connection error
await page.route('**/api/**', (r) => r.abort('internetdisconnected'));
await context.setOffline(true);                                          // whole context
```

A connection error is a different code path from a 500 - `fetch` rejects rather than resolving. Both need coverage.

## Malformed responses

```ts
await page.route('**/api/items', (r) => r.fulfill({ status: 200, body: 'not json' }));
await page.route('**/api/items', (r) => r.fulfill({ status: 200, json: { items: null } }));
await page.route('**/api/items', (r) => r.fulfill({ status: 200, json: {} }));   // missing field
```

The app should degrade, not white-screen. `items: null` where an array is expected is the classic `.map is not a function` crash.

## Timeouts and slow responses

```ts
await page.route('**/api/items', async (r) => {
  await new Promise((res) => setTimeout(res, 5_000));
  await r.fulfill({ json: { items: [] } });
});
await expect(page.getByRole('progressbar')).toBeVisible();
```

Slowing a response is the only reliable way to assert a loading state - without it the fast path renders before you can look. Also covers skeleton rendering, disabled submit buttons, and cancel affordances.

## Partial failure

```ts
await page.route('**/api/sidebar', (r) => r.fulfill({ status: 500 }));
await page.goto('/dashboard');
await expect(page.getByRole('main')).toBeVisible();          // page still works
await expect(page.getByTestId('sidebar-error')).toBeVisible();
```

One failing widget must not take down the page. This is what error boundaries are for, and it is rarely tested.

## Retry and recovery

```ts
let n = 0;
await page.route('**/api/items', (r) =>
  n++ === 0 ? r.fulfill({ status: 500 }) : r.fulfill({ json: { items: [{ id: 1 }] } }));

await page.goto('/items');
await page.getByRole('button', { name: 'Retry' }).click();
await expect(page.getByRole('listitem')).toHaveCount(1);
await expect(page.getByRole('alert')).toBeHidden();          // error cleared
```

The cleared-error assertion matters - a stale error banner left visible after a successful retry is a common regression.

## Empty and boundary states

Underrated and cheap: zero items, exactly one, exactly the page size, page size + 1, and a very large set. Assert the empty state has an actionable message, not a blank panel.

```ts
await page.route('**/api/items', (r) => r.fulfill({ json: { items: [] } }));
await expect(page.getByText('No items yet')).toBeVisible();
await expect(page.getByRole('button', { name: 'Create item' })).toBeVisible();
```

Long strings, unicode, emoji, and RTL text in every user-supplied field - these break layout, and layout breakage is silent.

## Concurrency

Double-clicking submit, navigating away mid-request, and a stale response arriving after a newer one (the out-of-order search-results bug). Sequence responses with a counter to reproduce it deterministically.
