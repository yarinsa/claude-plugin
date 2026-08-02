# Accessibility testing

## axe-core scan

```ts
import AxeBuilder from '@axe-core/playwright';

test('dashboard has no a11y violations', async ({ page }) => {
  await page.goto('/dashboard');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(violations).toEqual([]);
});
```

When it fails, print something actionable rather than a wall of JSON:

```ts
expect(violations.map((v) => `${v.id}: ${v.nodes.length} - ${v.help}`)).toEqual([]);
```

## What axe does and does not catch

axe finds roughly a third of real accessibility defects - contrast, missing labels, ARIA misuse, heading order, landmark structure. It cannot judge whether focus order makes sense, whether an announcement is useful, or whether a custom widget is operable.

Do not treat a green axe run as "accessible". Pair it with the keyboard and focus tests below, which catch the things axe structurally cannot.

## Scoping and triage

```ts
new AxeBuilder({ page })
  .include('main')
  .exclude('#third-party-widget')        // not yours to fix
  .disableRules(['color-contrast'])      // only with a linked issue
```

Excluding a vendor iframe is legitimate. Disabling `color-contrast` globally because the palette fails is how a suite becomes decorative - fix the palette or track it.

Adopting axe on an existing app: snapshot the current violation IDs as an allowlist, assert no *new* ones, and burn the list down.

```ts
const known = new Set(['color-contrast']);
expect(violations.filter((v) => !known.has(v.id))).toEqual([]);
```

## Keyboard operability

Every interactive control must be reachable and operable without a mouse.

```ts
await page.keyboard.press('Tab');
await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();

await page.getByRole('button', { name: 'Menu' }).press('Enter');
await expect(page.getByRole('menu')).toBeVisible();
await page.keyboard.press('Escape');
await expect(page.getByRole('menu')).toBeHidden();
```

Assert the full tab order of a form explicitly - it is a cheap test and tab order breaks silently on any layout change:

```ts
for (const name of ['Email', 'Password', 'Sign in']) {
  await page.keyboard.press('Tab');
  await expect(page.getByLabel(name).or(page.getByRole('button', { name }))).toBeFocused();
}
```

## Focus management

The highest-value a11y assertions, and the ones axe never makes:

- Opening a modal moves focus into it.
- Focus is trapped while it is open.
- Closing returns focus to the trigger.

```ts
const trigger = page.getByRole('button', { name: 'Settings' });
await trigger.click();
await expect(page.getByRole('dialog')).toBeFocused();
await page.keyboard.press('Escape');
await expect(trigger).toBeFocused();
```

## Screen-reader semantics

You cannot run a screen reader, but you can assert what it would announce:

```ts
await expect(page.getByRole('status')).toHaveText('3 results');       // live region
await expect(page.getByRole('button', { name: 'Close' })).toHaveAttribute('aria-label', 'Close');
await expect(page.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
expect(await page.getByRole('heading').allTextContents()).toEqual([...]);   // heading outline
```

## Roles make tests better anyway

Using `getByRole` everywhere means the E2E suite fails when the accessibility tree breaks - free regression coverage, which is the strongest argument for the locator priority in `core/locators.md`.

## Reduced motion and zoom

```ts
await page.emulateMedia({ reducedMotion: 'reduce' });
await page.setViewportSize({ width: 320, height: 900 });   // ~400% zoom reflow
```
