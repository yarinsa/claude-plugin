# Multiple contexts, tabs, and users

## Contexts are the isolation boundary

One browser, many contexts. Each context has its own cookies, storage, and cache - that is how you get two logged-in users in a single test.

```ts
test('comment appears for the other user', async ({ browser }) => {
  const alice = await browser.newContext({ storageState: '.auth/alice.json' });
  const bob = await browser.newContext({ storageState: '.auth/bob.json' });
  const alicePage = await alice.newPage();
  const bobPage = await bob.newPage();

  await alicePage.goto('/doc/1');
  await bobPage.goto('/doc/1');

  await alicePage.getByRole('textbox', { name: 'Comment' }).fill('hello');
  await alicePage.getByRole('button', { name: 'Post' }).click();

  await expect(bobPage.getByText('hello')).toBeVisible();

  await alice.close();
  await bob.close();
});
```

Wrap the pair in a fixture when more than two tests need it, so close-on-failure is guaranteed:

```ts
twoUsers: async ({ browser }, use) => {
  const a = await browser.newContext({ storageState: '.auth/alice.json' });
  const b = await browser.newContext({ storageState: '.auth/bob.json' });
  await use({ alice: await a.newPage(), bob: await b.newPage() });
  await a.close(); await b.close();
},
```

Two `page`s in the **same** context share a session - correct for multi-tab behavior in one account, wrong for two users.

## Popups

```ts
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.getByRole('button', { name: 'Open preview' }).click(),
]);
await popup.waitForLoadState();
await expect(popup.getByRole('heading')).toHaveText('Preview');
await popup.close();
```

Start the wait before the click, or the popup opens before you are listening.

## OAuth popups

```ts
const [oauth] = await Promise.all([
  page.waitForEvent('popup'),
  page.getByRole('button', { name: 'Continue with Google' }).click(),
]);
await oauth.getByLabel('Email').fill(user);
await oauth.getByRole('button', { name: 'Next' }).click();
await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
```

Works, but a real IdP in CI is a permanent flake source and will eventually trip bot detection. Prefer a test IdP or a stubbed callback, and keep at most one such test.

## New tabs from links

```ts
const [tab] = await Promise.all([
  context.waitForEvent('page'),
  page.getByRole('link', { name: 'Docs' }).click(),   // target="_blank"
]);
```

`context.waitForEvent('page')` for any new page in the context; `page.waitForEvent('popup')` for one opened by that specific page.

## Switching between open pages

```ts
const pages = context.pages();
await pages[1].bringToFront();
```

`bringToFront` matters only for focus- and visibility-sensitive behavior (`document.hidden`, autoplay, `IntersectionObserver`). Actions work on background pages without it.

## Dialogs

```ts
page.on('dialog', (d) => d.accept('typed value'));
await page.getByRole('button', { name: 'Delete' }).click();
```

Register the handler before triggering. Playwright auto-dismisses dialogs when no handler is attached, so an unhandled `confirm()` silently returns false.

## Roles in one test

For role-based access, two contexts beats logging out and back in - it is faster and asserts the real concurrent state:

```ts
await expect(adminPage.getByRole('button', { name: 'Delete' })).toBeVisible();
await expect(viewerPage.getByRole('button', { name: 'Delete' })).toBeHidden();
```

## Always close

Leaked contexts exhaust the browser and slow the run. Close in fixture teardown so it happens on failure too.
