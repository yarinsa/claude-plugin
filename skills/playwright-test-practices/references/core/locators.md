# Locators

## Priority order

1. `getByRole(role, { name })` - matches the accessibility tree. Survives markup changes, and a failure usually means a real a11y regression.
2. `getByLabel` / `getByPlaceholder` - form controls.
3. `getByText` - non-interactive copy.
4. `getByTestId` - escape hatch when no role or stable text exists (canvas, virtualized rows, third-party widgets).
5. CSS / XPath - last resort. Acceptable for library-owned class contracts (`.react-flow__node`) where the library guarantees the class; never for app markup.

If a control has no role, that is usually a bug in the markup, not a reason to reach for CSS. Add the role first.

## Locators are lazy

A locator is a query, not an element handle. It re-resolves on every action, so it is immune to re-renders. Never store `elementHandle`.

```ts
const row = page.getByRole('row', { name: 'invoice-2043' });
await row.getByRole('button', { name: 'Delete' }).click();
```

## Strictness

Playwright throws if a locator resolves to more than one node. That is a feature - do not silence it with `.first()`. Narrow instead:

```ts
// Bad - hides ambiguity, picks an arbitrary match
page.getByRole('button', { name: 'Edit' }).first();

// Good - scope to the owning row
page.getByRole('row', { name: 'Acme Corp' }).getByRole('button', { name: 'Edit' });
```

`.first()` / `.nth()` are legitimate only when the set is genuinely homogeneous and order is the thing under test (e.g. "the first result is the highest score").

## Chaining and filtering

```ts
page.getByRole('listitem').filter({ hasText: 'Overdue' });
page.getByRole('listitem').filter({ has: page.getByRole('img', { name: 'Warning' }) });
page.getByRole('listitem').filter({ hasNot: page.getByText('Archived') });
```

`filter` runs in the browser and is retried, unlike JS-side `.all()` + `Array.filter`, which snapshots.

## Name matching

`name` is accessible-name matching: case-insensitive, whitespace-normalized, substring by default in some APIs. Pin it when partial matches collide:

```ts
page.getByRole('button', { name: 'Save', exact: true });
page.getByRole('heading', { name: /^Results \(\d+\)$/ });
```

## Iterating

```ts
for (const row of await page.getByRole('row').all()) { ... }
```

`.all()` snapshots the current matches. Only use it after the list has settled - assert the count first:

```ts
await expect(page.getByRole('row')).toHaveCount(11);
const rows = await page.getByRole('row').all();
```

## Shadow DOM and frames

Playwright pierces open shadow roots automatically. For iframes, get a `FrameLocator`:

```ts
page.frameLocator('iframe[title="Checkout"]').getByRole('button', { name: 'Pay' });
```

## Anti-patterns

- `page.$` / `page.$$` / `elementHandle` - legacy, no auto-retry, detaches on re-render.
- Selectors encoding styling (`.mt-4 > div:nth-child(3)`).
- `page.locator(\`text=${userInput}\`)` - unescaped interpolation. Use `getByText(userInput)`.
- `.first()` used to paper over a strict-mode violation.
