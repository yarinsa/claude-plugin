# Debugging

## Order of operations

1. **Read the error.** Playwright's messages are specific - strict-mode violations list every match; timeouts print the last-known element state and the actual vs expected value. Most failures are diagnosed here.
2. **Open the trace.** `npx playwright show-trace <path>` or the trace link in the HTML report.
3. **Reproduce in the UI runner.** `npx playwright test --ui`.
4. Only then start adding instrumentation.

## Trace viewer

```bash
npx playwright test --trace on          # force for a local repro
npx playwright show-trace test-output/.../trace.zip
npx playwright show-report
```

The trace gives you, per action: a DOM snapshot before and after, the locator used and what it resolved to, console output, network, and the source line. The **before/after snapshots are the key feature** - you can inspect the real DOM at the moment the locator failed and see whether the element was absent, detached, covered, or simply named differently.

`trace: 'on-first-retry'` is the right CI setting; you get a trace exactly for failures and pay nothing on green runs.

## UI mode

```bash
npx playwright test --ui
```

Watch mode, time-travel through steps, a live locator picker, and re-run of a single test. This is the primary local workflow - `--headed` and `--debug` are fallbacks.

## Inspector and headed runs

```bash
npx playwright test --debug                    # Inspector, step through
npx playwright test --headed --workers=1       # watch it happen
PWDEBUG=1 npx playwright test                  # Inspector + disables timeouts
```

`PWDEBUG=1` disabling timeouts matters - otherwise the test times out while you are reading the paused state.

```ts
await page.pause();   // breakpoint; opens the Inspector at this line
```

## Diagnosing a locator

```bash
npx playwright codegen <url>      # pick elements, see the generated locator
```

```ts
console.log(await locator.count());
console.log(await page.getByRole('button').allInnerTexts());
await expect(locator).toBeVisible();          // the failure message describes actual state
```

For "element not found", check in this order: is it inside an iframe, is it in a portal rendered elsewhere in the DOM, is the accessible name different from the visible text (an `aria-label` overrides inner text), is it covered by an overlay, is it actually rendered yet.

## Console and network

```ts
page.on('console', (m) => console.log(`[${m.type()}]`, m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('requestfailed', (r) => console.log('[failed]', r.url(), r.failure()?.errorText));
page.on('response', (r) => r.status() >= 400 && console.log('[http]', r.status(), r.url()));
```

Attach these in a debug-only auto fixture rather than pasting them into individual tests.

## Screenshots and DOM dumps

```ts
await page.screenshot({ path: 'debug.png', fullPage: true });
console.log(await page.content());
await testInfo.attach('dom', { body: await page.content(), contentType: 'text/html' });
```

`testInfo.attach` puts the artifact in the HTML report next to the failure, which is far more useful in CI than a file written to a runner that is about to be destroyed.

## Verbose logs

```bash
DEBUG=pw:api npx playwright test        # every Playwright action
DEBUG=pw:browser npx playwright test    # browser process / launch failures
```

`pw:api` is the tool for "the test hangs and I cannot tell where" - the last logged action is the one that is stuck.

## CI-only failures

Work the differences in this order: timing (slower runner, cold caches), viewport, locale and timezone, animations, and missing local state. Reproduce with CI's settings locally:

```bash
CI=1 npx playwright test --workers=4 --repeat-each=3
```

Then read the CI trace artifact - do not guess.
