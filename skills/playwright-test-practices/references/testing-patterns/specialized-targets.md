# Canvas, WebGL, Electron, extensions

Targets with no accessibility tree, or no ordinary page.

## Canvas and WebGL

There is nothing to locate inside a canvas. Three workable strategies, best first:

**1. Test the model, not the pixels.** Expose state on `window` in dev/test builds and assert that:

```ts
const nodes = await page.evaluate(() => window.__graph?.getNodes().map((n) => n.id));
expect(nodes).toEqual(['a1', 'a2', 't1']);
```

By far the most stable. The rendering library already has tests; yours should cover your logic.

**2. Use the library's DOM output where it exists.** Many "canvas" libraries render DOM. React Flow, for instance, emits real nodes:

```ts
await expect(page.locator('.react-flow__node')).toHaveCount(11);
```

Class-based selectors are acceptable here - the library guarantees them as a contract.

**3. Screenshot the canvas** as a last resort, after seeding deterministic data and disabling animation:

```ts
await expect(page.locator('canvas')).toHaveScreenshot('chart.png', { maxDiffPixelRatio: 0.02 });
```

GPU rasterization differs between machines, so a canvas baseline **must** be generated in the CI container. Allow a looser threshold than for DOM screenshots.

Interacting requires coordinates:

```ts
const box = (await page.locator('canvas').boundingBox())!;
await page.mouse.click(box.x + 120, box.y + 80);
```

Derive coordinates from data (ask the app where the node is) rather than hardcoding - hardcoded pixels break on any layout change.

Check WebGL is actually available before asserting; headless runners without a GPU may fall back to SwiftShader or fail:

```ts
const ok = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
test.skip(!ok, 'no WebGL in this environment');
```

## Electron

```ts
import { _electron as electron } from '@playwright/test';

const app = await electron.launch({ args: ['.'] });
const window = await app.firstWindow();
await expect(window.getByRole('heading')).toHaveText('Ready');
await app.close();
```

The renderer is an ordinary page - every locator and assertion works. What differs:

```ts
const isPackaged = await app.evaluate(async ({ app }) => app.isPackaged);   // main process
```

`app.evaluate` runs in the **main** process, which is how you assert on menus, dialogs, and IPC. Native OS dialogs cannot be driven - stub `dialog.showOpenDialog` from the main process instead:

```ts
await app.evaluate(async ({ dialog }) => {
  dialog.showOpenDialog = async () => ({ canceled: false, filePaths: ['/tmp/a.txt'] });
});
```

Multi-window apps: `app.windows()`, and `app.waitForEvent('window')` for one opened by an action.

## Browser extensions

Chromium only, and headless requires the new headless mode:

```ts
const context = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  args: [`--disable-extensions-except=${pathToExt}`, `--load-extension=${pathToExt}`],
});
```

A **persistent context** is mandatory - extensions do not load in a regular context.

Get the extension ID from the service worker, then address its pages:

```ts
const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
const id = new URL(worker.url()).host;
const popup = await context.newPage();
await popup.goto(`chrome-extension://${id}/popup.html`);
```

Content scripts are tested by opening an ordinary page and asserting the injected DOM. Background/service-worker logic is tested via `worker.evaluate`.
