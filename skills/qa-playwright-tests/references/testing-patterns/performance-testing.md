# Performance budgets

Playwright measures performance reliably enough for **regression detection**, not for absolute numbers. CI runners are noisy; treat a single run as a sample.

## Web Vitals

```ts
const lcp = await page.evaluate(() => new Promise<number>((resolve) => {
  new PerformanceObserver((l) => {
    const e = l.getEntries();
    resolve(e[e.length - 1].startTime);
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  setTimeout(() => resolve(-1), 10_000);
}));
expect(lcp).toBeLessThan(2_500);
```

Always include the timeout fallback - LCP never resolves on a page that has no qualifying element, and the test hangs instead of failing.

CLS accumulates, so read it at the end of the interaction, not at load:

```ts
const cls = await page.evaluate(() => new Promise<number>((resolve) => {
  let v = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (!e.hadRecentInput) v += e.value;
    }
  }).observe({ type: 'layout-shift', buffered: true });
  setTimeout(() => resolve(v), 3_000);
}));
expect(cls).toBeLessThan(0.1);
```

## Navigation timing

```ts
const t = await page.evaluate(() =>
  JSON.parse(JSON.stringify(performance.getEntriesByType('navigation')[0])));
expect(t.domContentLoadedEventEnd).toBeLessThan(2_000);
```

## Bundle weight

The most stable metric and the best regression signal - it does not depend on runner load:

```ts
let bytes = 0;
page.on('response', async (r) => {
  if (/\.(js|css)$/.test(new URL(r.url()).pathname)) {
    bytes += Number(r.headers()['content-length'] ?? 0);
  }
});
await page.goto('/');
expect(bytes).toBeLessThan(500 * 1024);
```

A hard byte budget in CI is the single highest-value performance test most teams are missing.

Also assert request counts and that no unexpected third-party origin loads on the critical path.

## Interaction latency

```ts
const start = Date.now();
await page.getByRole('button', { name: 'Search' }).click();
await expect(page.getByRole('listitem').first()).toBeVisible();
expect(Date.now() - start).toBeLessThan(1_000);
```

Keep budgets loose - 2-3x the observed median. A tight budget on a shared runner produces a flaky test, which gets deleted, which means no budget at all.

## Throttling

```ts
const client = await page.context().newCDPSession(page);
await client.send('Network.emulateNetworkConditions', {
  offline: false, downloadThroughput: 1.5 * 1024 * 1024 / 8,
  uploadThroughput: 750 * 1024 / 8, latency: 40,
});
await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
```

Chromium only. CPU throttling is the more revealing of the two for modern SPAs.

## Lighthouse

Run via `playwright-lighthouse` or a separate Lighthouse CI job. Prefer the separate job - Lighthouse wants a clean, unthrottled, single-run environment, and mixing it into a sharded E2E suite gives numbers you cannot compare across runs.

## Practical setup

- Tag these `@perf` and run them in a dedicated, unsharded job on a consistent runner.
- Do not gate PRs on absolute numbers. Gate on **bundle size**; report the rest as a trend.
- Median of 3+ runs, never a single measurement, for anything time-based.
