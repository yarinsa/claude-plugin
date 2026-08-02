# Browser APIs

## Permissions

```ts
await context.grantPermissions(['geolocation', 'clipboard-read', 'clipboard-write'], { origin: baseURL });
await context.clearPermissions();
```

Grant before navigation. Denial is the default, so a permission-denied path needs no setup - which makes it the easy case to cover and the one usually missed.

## Geolocation

```ts
const context = await browser.newContext({
  geolocation: { latitude: 32.0853, longitude: 34.7818 },
  permissions: ['geolocation'],
  locale: 'en-US',
});
await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });   // simulate movement
```

Both the permission and the coordinates are required; setting only coordinates leaves the request blocked.

## Clipboard

```ts
await context.grantPermissions(['clipboard-read', 'clipboard-write']);
await page.getByRole('button', { name: 'Copy link' }).click();
const text = await page.evaluate(() => navigator.clipboard.readText());
expect(text).toBe('https://example.com/x');
```

Clipboard requires a focused, secure context. Reliable in Chromium; flaky-to-unsupported in WebKit - skip there rather than fight it.

## Media devices

```ts
const context = await browser.newContext({
  permissions: ['camera', 'microphone'],
});
```

Feed a fake stream via launch args:

```ts
launchOptions: { args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] },
```

Chromium only. You get a synthetic pattern, enough to assert the video element plays and the UI transitions.

## iframes

```ts
const frame = page.frameLocator('iframe[title="Checkout"]');
await frame.getByRole('button', { name: 'Pay' }).click();
```

`FrameLocator` auto-waits and re-resolves, unlike `page.frame()`. Nest for iframes inside iframes. Cross-origin frames work for interaction, but `page.evaluate` cannot reach into them.

Third-party payment iframes change markup without notice - keep those tests few and prefer a stubbed provider.

## WebSockets

```ts
await page.routeWebSocket('wss://**/live', (ws) => {
  ws.onMessage((m) => { if (m === 'sub') ws.send(JSON.stringify({ type: 'tick', v: 1 })); });
});
```

Deterministic server-push without a real backend. To observe rather than mock:

```ts
page.on('websocket', (ws) => ws.on('framereceived', (f) => console.log(f.payload)));
```

## Service workers and offline

```ts
const context = await browser.newContext({ serviceWorkers: 'block' });   // or 'allow'
await context.setOffline(true);
await expect(page.getByText('You are offline')).toBeVisible();
await context.setOffline(false);
```

Block service workers in most suites - a stale cached bundle produces the worst class of flake. Allow them only in the tests that cover offline behavior.

Wait for registration before asserting cached behavior:

```ts
await page.evaluate(() => navigator.serviceWorker.ready);
```

Then reload offline to prove the cache serves the shell.

## Downloads and uploads

```ts
const [download] = await Promise.all([
  page.waitForEvent('download'),
  page.getByRole('button', { name: 'Export CSV' }).click(),
]);
expect(download.suggestedFilename()).toMatch(/\.csv$/);
const content = fs.readFileSync(await download.path(), 'utf-8');
expect(content.split('\n')[0]).toBe('id,name,status');
```

Assert the **contents**, not just that a file arrived - a download test that only checks the filename passes on an empty file.

```ts
await page.getByLabel('Attachment').setInputFiles('./fixtures/a.pdf');
await page.getByLabel('Attachment').setInputFiles([]);            // clear
await page.getByLabel('Attachment').setInputFiles({ name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') });
```

The buffer form avoids committing binary fixtures. For a drop zone with no `<input>`, dispatch a synthetic `DataTransfer` via `page.evaluate`, or test the input path and cover the drag handler in a unit test.

## Notifications, fullscreen, print

```ts
await context.grantPermissions(['notifications']);
await page.evaluate(() => document.documentElement.requestFullscreen());
await page.emulateMedia({ media: 'print' });
```

`emulateMedia` is also how you test `prefers-color-scheme` and `prefers-reduced-motion`:

```ts
await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
```
