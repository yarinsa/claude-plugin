# Visual regression

## Basics

```ts
await expect(page).toHaveScreenshot('dashboard.png');
await expect(page.getByTestId('chart')).toHaveScreenshot('chart.png');
```

First run writes the baseline; later runs diff against it. `--update-snapshots` re-records.

Baselines are platform-specific - font rendering differs between macOS and Linux. **Generate baselines in the same container CI uses**, or every local run fails. This is the number one reason teams abandon visual testing.

```bash
docker run --rm -v $(pwd):/w -w /w mcr.microsoft.com/playwright:v1.x-jammy \
  npx playwright test --update-snapshots
```

## Make it deterministic first

Visual tests amplify every nondeterminism in the app. Before adding one, pin:

```ts
await expect(page).toHaveScreenshot({
  animations: 'disabled',        // freezes CSS animations/transitions
  caret: 'hide',                 // blinking text caret
  mask: [page.getByTestId('timestamp'), page.getByRole('img', { name: 'Avatar' })],
  maxDiffPixelRatio: 0.01,
});
```

- `animations: 'disabled'` - non-negotiable.
- `mask` - covers dynamic regions with a solid block. Use for timestamps, avatars, IDs, and charts with random data.
- `maxDiffPixelRatio` over `maxDiffPixels` - resolution-independent. Start at `0.01` and tighten; a threshold of zero fails on antialiasing.
- Pin `locale`, `timezoneId`, and viewport in the config.

Fonts must be loaded before the shot:

```ts
await page.evaluate(() => document.fonts.ready);
```

A screenshot taken mid-font-swap differs from every subsequent run.

## Scope tightly

Prefer a component screenshot to a full-page one. A full-page baseline fails on any unrelated change, so the diff gets rubber-stamped - and then a real regression is approved with it.

Story-driven visual tests (`architecture/test-architecture.md`) are the natural fit: one component, fixed props, no app state.

## What to cover

Good candidates: design-system primitives across variants, charts and canvas output, print/email templates, dark and light themes, RTL layout.

Poor candidates: content-heavy pages, anything with live data, whole dashboards. Use assertions on structure instead.

## Theme and preference matrices

```ts
for (const colorScheme of ['light', 'dark'] as const) {
  test(`button ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(url);
    await expect(page.getByRole('button')).toHaveScreenshot(`button-${colorScheme}.png`);
  });
}
```

## Reviewing diffs

The HTML report shows expected / actual / diff. Treat an unexplained diff as a failure - the failure mode of visual testing is approval fatigue, not false negatives. If baselines need updating on most PRs, the tests are scoped too broadly.

Commit baselines to git and review them in the PR like code. A baseline changing is a design change and deserves a reviewer.

## Cost

Baselines are binary files that grow the repo. Keep the set small and intentional - a few dozen meaningful component shots beat hundreds of page shots nobody reads.
