# Console errors

## Fail the suite on unexpected console errors

A JS exception that does not break the assertion still breaks the product. Catch it with an auto fixture so every test is covered without opting in:

```ts
const IGNORED = [
  /ResizeObserver loop/,                       // benign, fires in Chromium on layout thrash
  /Download the React DevTools/,
];

export const test = base.extend<{ consoleGuard: void }>({
  consoleGuard: [async ({ page }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error' && !IGNORED.some((r) => r.test(m.text()))) errors.push(m.text());
    });
    page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
    await use();
    expect(errors, 'unexpected console errors').toEqual([]);
  }, { auto: true }],
});
```

Two distinct events, both needed:

- `console` with `type() === 'error'` - explicit `console.error` calls, including React's warnings.
- `pageerror` - **uncaught exceptions**. These never appear as `console` events, and they are the ones that matter most.

## Keep the ignore list small and justified

Every entry is coverage you gave up. Require a comment saying why, and prefer the narrowest possible regex. An ignore list that grows without review makes the guard decorative.

`ResizeObserver loop completed with undelivered notifications` is the one genuinely benign entry most apps need.

## Asserting an expected error

When a test deliberately triggers a failure, assert the error rather than suppressing the guard:

```ts
test('shows a fallback when the widget crashes', async ({ page }) => {
  const seen: string[] = [];
  page.on('pageerror', (e) => seen.push(e.message));
  await page.goto('/widget?crash=1');
  await expect(page.getByRole('alert')).toHaveText('Something went wrong');
  expect(seen.some((m) => m.includes('WidgetCrash'))).toBe(true);
});
```

## Failed requests

The network equivalent, and worth the same treatment:

```ts
page.on('requestfailed', (r) => failures.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`));
page.on('response', (r) => { if (r.status() >= 500) failures.push(`${r.status()} ${r.url()}`); });
```

A 500 that the UI silently swallows is invisible to assertions but is a real defect. Filter out third-party analytics domains (better: block them entirely - see `architecture/when-to-mock.md`).

## Attach on failure

```ts
await testInfo.attach('console.log', { body: errors.join('\n'), contentType: 'text/plain' });
```

Puts the log next to the failure in the HTML report, which survives the runner being destroyed.

## Rollout on an existing app

Turning this on for a mature app surfaces dozens of pre-existing errors. Snapshot the current set as the ignore list, gate new ones, and burn the list down - the same approach as the axe allowlist in `testing-patterns/accessibility.md`.
