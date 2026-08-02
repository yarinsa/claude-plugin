# Component testing

## Two viable approaches

**Playwright Component Testing** (`@playwright/experimental-ct-react`) mounts a component directly in a real browser:

```ts
import { test, expect } from '@playwright/experimental-ct-react';
import { Button } from './Button';

test('fires onClick', async ({ mount }) => {
  const clicks: string[] = [];
  const c = await mount(<Button onClick={() => clicks.push('x')}>Save</Button>);
  await c.getByRole('button').click();
  expect(clicks).toEqual(['x']);
});
```

**Story-driven testing** points a normal Playwright test at a Storybook story. If the repo already has Storybook, prefer this - the stories exist, designers use them, and you avoid a second, still-experimental toolchain. See `architecture/test-architecture.md`.

Playwright CT has been experimental for a long time. Choose it only when there is no Storybook and you specifically need real-browser component tests that jsdom cannot provide.

## What belongs here

Real-browser behavior at component scope: focus management, keyboard interaction, layout and overflow, `IntersectionObserver`, canvas, CSS-dependent logic, portals and stacking, drag.

Pure logic and prop-mapping belong in unit tests with Testing Library - much faster.

## Props, slots, events

```ts
const component = await mount(<Select options={opts} onChange={spy} />);
await component.update(<Select options={opts} value="b" onChange={spy} />);
```

`update` re-renders with new props - the way to test a controlled component's response to a parent change.

Capture events by pushing into an array and asserting the array, rather than a mock-call-count assertion. It reads better and shows the payload on failure.

## Mocking dependencies

```ts
test.use({ viewport: { width: 500, height: 500 } });

const component = await mount(<Chart />, {
  hooksConfig: { theme: 'dark' },     // consumed by playwright/index.tsx
});
```

Wrap providers (router, theme, query client) once in `playwright/index.tsx` rather than in every test. Network calls are intercepted with `page.route` exactly as in E2E.

## Storybook equivalent

```ts
const storyUrl = (id: string) => `/iframe.html?id=${id}&viewMode=story`;

test('menu closes on Escape', async ({ page }) => {
  await page.goto(storyUrl('components-menu--open'));
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toBeHidden();
});
```

Vary props by writing another story rather than by parameterizing the URL - the story is then also visible in the Storybook UI and reviewable by design.

Story IDs derive from title plus export name, so a rename breaks the URL silently. Assert something renders immediately after `goto` so the failure is legible.

## Keep components deterministic

The whole benefit is that a component test has no app state. Do not reintroduce it: no real network, no shared singletons, fixed dates, seeded randomness. A flaky component test has no excuse.
