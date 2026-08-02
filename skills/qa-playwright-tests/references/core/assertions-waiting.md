# Assertions and waiting

## Web-first assertions retry; plain ones do not

```ts
// Good - polls until it passes or the expect timeout expires
await expect(page.getByRole('status')).toHaveText('Synced');

// Bad - reads once, races the render
expect(await page.getByRole('status').textContent()).toBe('Synced');
```

Any `expect(locator)` assertion auto-retries. The moment you `await` a value out of the page and assert on the plain value, you have a snapshot and a race. This single distinction eliminates most flakiness.

## Never sleep

`page.waitForTimeout(n)` is banned in committed tests with exactly one exception: a **documented, bounded** debounce or throttle window where no observable state changes at the end of it.

```ts
// Legitimate - nuqs URL writes are throttled at 100ms; nothing else signals the flush.
await page.waitForTimeout(250);
const g = await page.evaluate(() => new URLSearchParams(location.search).get('g'));
expect(g).toBeNull();
```

Note the shape: a comment naming the actual throttle constant, and a value comfortably above it. Asserting a *disappearance* (something stays null) is the one case with no event to await. Everywhere else, wait for the condition:

```ts
await page.waitForFunction((s) => location.search.includes(s), 'hidden=Agent', { timeout: 3_000 });
```

## Auto-waiting is built into actions

`click`, `fill`, `check` already wait for the element to be attached, visible, stable, enabled, and hit-testable. Do not precede them with a visibility assertion:

```ts
// Redundant
await expect(button).toBeVisible();
await button.click();

// Enough
await button.click();
```

Assert visibility when *visibility itself* is the thing under test, not as a guard.

## Wait for the state, not the mechanism

```ts
// Fragile - couples to the network layer
await page.waitForResponse('**/api/items');

// Robust - asserts what the user sees
await expect(page.getByRole('row')).toHaveCount(11);
```

`waitForResponse` is right when the response is genuinely the subject (asserting a request fired, or capturing a payload). It is wrong as a proxy for "the UI updated" - the response can land before render.

## Timeouts

```ts
expect: { timeout: 15_000 },   // global assertion timeout
```

Set a generous global timeout once, and override per-assertion only where a genuinely slow operation justifies it:

```ts
await expect(page.locator('.react-flow__node')).toHaveCount(11, { timeout: 15_000 });
```

Scatter of ad-hoc `{ timeout: 30_000 }` across a file is a smell - it usually means an unaddressed wait, not a slow app.

## Useful assertions

```ts
await expect(list).toHaveCount(3);
await expect(input).toHaveValue('abc');
await expect(el).toHaveAttribute('aria-expanded', 'true');
await expect(el).toHaveClass(/selected/);
await expect(page).toHaveURL(/\/invoices\/\d+/);
await expect(page).toHaveTitle('Dashboard');
await expect(el).toBeInViewport();
await expect(rows).toHaveText(['a', 'b', 'c']);   // array form asserts the whole list, in order
```

`toHaveText` with an array is far better than looping - one retrying assertion covering order and content.

## Soft assertions

```ts
await expect.soft(el).toHaveText('a');   // records failure, test continues
```

Use for independent checks in a report-style test. Do not use before an action that depends on the assertion holding.

## Polling arbitrary state

```ts
await expect.poll(async () => (await api.get('/jobs/1')).status, { timeout: 30_000 }).toBe('done');
await expect(async () => { expect(await countRows()).toBe(3); }).toPass({ timeout: 10_000 });
```

`expect.poll` for a value, `toPass` for a block of assertions that should eventually all hold.

## Anti-patterns

- `waitForTimeout` as a general fix for flakiness.
- `waitForSelector` - superseded by `expect(locator).toBeVisible()`.
- `waitForLoadState('networkidle')` - deprecated in spirit; a polling app never goes idle. Assert on UI state.
- Asserting on `textContent()` / `innerText()` return values instead of `toHaveText`.
