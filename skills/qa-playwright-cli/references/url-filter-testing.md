# Testing URL params and filter sync

## Core: toHaveURL with predicate

Idiomatic pattern uses `toHaveURL()` with a predicate function receiving a `URL` object, giving direct access to `.searchParams`. Better than regex — readable, handles param ordering, multi-environment URLs, partial matching without hardcoding.

```ts
await expect(page).toHaveURL(url => {
  const params = url.searchParams;
  return params.get('status') === 'active' && params.get('type') === 'agent';
});
```

## Three common scenarios

**1. Filter interaction → URL sync**
```ts
test('filter updates URL params', async ({ page }) => {
  await page.goto('/inventory');
  await page.getByRole('combobox', { name: 'Status' }).selectOption('critical');
  await expect(page).toHaveURL(url =>
    url.searchParams.get('status') === 'critical'
  );
  await expect(page.getByTestId('inventory-item')).not.toHaveCount(0);
});
```

**2. URL params → filter UI state (deep-linking)**
```ts
test('pre-populates filters from URL params', async ({ page }) => {
  await page.goto('/inventory?status=critical&type=agent');
  await expect(page.getByRole('combobox', { name: 'Status' })).toHaveValue('critical');
  await expect(page.getByRole('combobox', { name: 'Type' })).toHaveValue('agent');
});
```

**3. Multiple params with toMatchObject**
```ts
function getSearchParams(page: Page): Record<string, string> {
  return Object.fromEntries(new URL(page.url()).searchParams.entries());
}

test('multiple filters set correct params', async ({ page }) => {
  await page.goto('/inventory');
  await page.getByLabel('Severity').selectOption('high');
  await page.getByLabel('Owner').fill('team-a');
  await page.keyboard.press('Enter');
  expect(getSearchParams(page)).toMatchObject({
    severity: 'high',
    owner: 'team-a',
  });
});
```

## Page Object Model pattern

```ts
// filters.page.ts
import { Page, expect } from '@playwright/test';

export class FiltersPage {
  constructor(private page: Page) {}

  async goto(params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    await this.page.goto(`/inventory${query}`);
  }

  async applyFilter(name: string, value: string) {
    await this.page.getByLabel(name).selectOption(value);
  }

  async assertURLHasParams(expected: Record<string, string>) {
    await expect(this.page).toHaveURL(url =>
      Object.entries(expected).every(([k, v]) => url.searchParams.get(k) === v)
    );
  }

  async assertURLPathOnly(path: string) {
    const current = new URL(this.page.url());
    expect(current.pathname).toBe(path);
  }
}
```

```ts
// filters.spec.ts
import { test } from '@playwright/test';
import { FiltersPage } from './filters.page';

test.describe('Inventory Filters', () => {
  let filtersPage: FiltersPage;

  test.beforeEach(async ({ page }) => {
    filtersPage = new FiltersPage(page);
    await filtersPage.goto();
  });

  test('status filter updates URL', async () => {
    await filtersPage.applyFilter('Status', 'critical');
    await filtersPage.assertURLHasParams({ status: 'critical' });
  });

  test('deep link pre-fills filter UI', async ({ page }) => {
    await filtersPage.goto({ status: 'critical', type: 'agent' });
    await expect(page.getByLabel('Status')).toHaveValue('critical');
  });
});
```

## Data-driven filter tests
```ts
const filterCases = [
  { name: 'Status', param: 'status', value: 'active' },
  { name: 'Severity', param: 'severity', value: 'high' },
  { name: 'Owner',   param: 'owner',   value: 'team-a' },
];

for (const { name, param, value } of filterCases) {
  test(`filter: ${name} = ${value}`, async ({ page }) => {
    await page.goto('/inventory');
    await page.getByLabel(name).selectOption(value);
    await expect(page).toHaveURL(url => url.searchParams.get(param) === value);
  });
}
```

## Summary table

| Pattern | When to use |
|---------|-------------|
| `toHaveURL(url => url.searchParams.get(...))` | Single param, most readable |
| `toMatchObject(Object.fromEntries(searchParams))` | Multi-param in one shot |
| `new URL(page.url()).pathname` | Path only, ignore params |
| `page.goto('/path?param=val')` | Deep-link / initial state |
| POM with `assertURLHasParams()` | Reusable across files |

Predicate form of `toHaveURL` is the cleanest modern approach — retries automatically (no need for `waitForURL`), works across environments, avoids fragile regex strings.
