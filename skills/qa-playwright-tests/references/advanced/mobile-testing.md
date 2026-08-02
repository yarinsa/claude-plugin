# Mobile and responsive

## Device emulation

```ts
import { devices } from '@playwright/test';

projects: [
  { name: 'mobile', use: { ...devices['Pixel 7'] } },
  { name: 'tablet', use: { ...devices['iPad Pro 11'] } },
],
```

```ts
test.use({ ...devices['iPhone 14'] });   // per-file
```

A device descriptor sets viewport, `deviceScaleFactor`, `isMobile`, `hasTouch`, and the user agent together. Setting only the viewport is the common mistake - the app still gets a desktop UA and `hasTouch: false`, so touch handlers and UA-sniffing code paths never run.

This is emulation in a desktop engine, not a real device. It catches layout and touch-handler bugs; it does not catch iOS Safari engine quirks. `devices['iPhone 14']` runs WebKit only if the project's `browserName` is WebKit.

## Breakpoints

```ts
for (const [name, size] of Object.entries({
  mobile: { width: 375, height: 667 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
})) {
  test(`nav at ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await page.goto('/');
    // ...
  });
}
```

Test **at** your CSS breakpoints and one pixel either side. Bugs live on the boundary, not in the middle of a range.

## Touch gestures

```ts
await page.getByRole('button').tap();      // requires hasTouch: true
```

Swipe:

```ts
const box = (await page.getByTestId('carousel').boundingBox())!;
await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + 10, box.y + box.height / 2, { steps: 20 });
await page.mouse.up();
```

`steps` is required - a single jump does not produce intermediate `touchmove` events and most swipe libraries ignore it.

Pinch-zoom and multi-touch are not supported. Test the zoom handler in a unit test.

## Orientation

```ts
await page.setViewportSize({ width: 667, height: 375 });   // landscape
```

There is no orientation API; swap the dimensions.

## Mobile-specific checks worth writing

- **Tap targets** - assert a minimum box size (44x44 CSS px) on primary actions.
- **Off-screen content** - `await expect(el).toBeInViewport()`.
- **No horizontal scroll**:

```ts
const overflow = await page.evaluate(() =>
  document.documentElement.scrollWidth > document.documentElement.clientWidth);
expect(overflow).toBe(false);
```

- **Virtual keyboard** - not emulated. Focus the input and assert layout, but you cannot reproduce the real viewport resize iOS performs.

## Cost

Every added device project multiplies runtime. Add a mobile project for responsive-critical flows only, tag the rest `@desktop`, and do not matrix every test across every device.
