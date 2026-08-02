# Clock and time

Anything reading the wall clock is non-deterministic. `page.clock` makes it testable.

## Install before navigation

```ts
await page.clock.install({ time: new Date('2024-03-15T10:00:00Z') });
await page.goto('/dashboard');
```

`install` must precede `goto` - it patches `Date`, `setTimeout`, `setInterval`, and friends at context init. Patching after the app booted leaves already-scheduled timers on the real clock.

## Two modes

```ts
await page.clock.fastForward('01:30');     // jump 90 minutes, fire timers along the way
await page.clock.runFor(5_000);            // advance 5s, running timers in order
await page.clock.pauseAt(new Date('2024-12-25T00:00:00Z'));
await page.clock.resume();
await page.clock.setFixedTime(new Date('2024-01-01'));   // Date is frozen; timers still run
```

- `setFixedTime` - `Date.now()` never moves, but `setTimeout` still fires. Right for "render this date deterministically" while the app stays alive.
- `pauseAt` + `runFor` - full control. Right for testing what happens *over* time.

## Session expiry

```ts
await page.clock.install();
await login(page);
await page.clock.fastForward('02:00');
await expect(page.getByText('Your session has expired')).toBeVisible();
```

The classic case - otherwise untestable without a two-hour test.

## Relative timestamps

```ts
await page.clock.setFixedTime(new Date('2024-03-15T12:00:00Z'));
// item createdAt: 2024-03-15T11:00:00Z
await expect(page.getByTestId('age')).toHaveText('1 hour ago');
```

Never assert "2 minutes ago" against a real clock. It passes until CI is slow.

## Polling and auto-refresh

```ts
await page.clock.install();
await page.goto('/live');
await page.clock.runFor(30_000);
await expect(page.getByRole('row')).toHaveCount(5);
```

Deterministically triggers a 30-second refresh instead of waiting 30 seconds.

## Debounce and throttle

```ts
await page.getByRole('searchbox').fill('abc');
await page.clock.runFor(300);                    // debounce window
await expect(page.getByRole('listitem')).toHaveCount(3);
```

This is the principled alternative to `waitForTimeout` for debounced UI. Prefer it whenever the app owns the timer.

Caveat: it does not help when the delay lives outside page JS - a server-side throttle, or a library batching via microtasks rather than timers. There, waiting on the observable result (or a documented short sleep) remains the only option.

## Timezone and locale

Independent of the clock, and equally important:

```ts
use: { timezoneId: 'UTC', locale: 'en-US' },
```

```ts
test.use({ timezoneId: 'Asia/Tokyo' });   // per-file override for a DST/offset test
```

Unpinned, a date-formatting test passes in CI (UTC) and fails on a laptop in another zone.

## Caveats

- `clock.install()` affects only the page's JS. Server-generated timestamps are unaffected - mock the response instead.
- Animations driven by `requestAnimationFrame` are also under the fake clock; a paused clock freezes them.
- Reset expectations if a third-party script captured `Date` before install - install early.
