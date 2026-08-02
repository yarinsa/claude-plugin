# Test architecture

## Pick the cheapest layer that can catch the bug

| Layer | Catches | Cost |
|---|---|---|
| Unit | Pure logic, reducers, formatting, validation rules | ms |
| Component (Playwright CT / Testing Library) | A component's rendered behavior in a real browser | ~100ms |
| Story-driven E2E | A component or subsystem in a real browser, with its real deps, in isolation | ~1s |
| API | Contracts, auth, persistence, error codes | ~100ms |
| Full E2E | Routing, cross-page state, auth, third-party embeds | seconds |

Push down relentlessly. Duplicating a validation rule in E2E buys nothing and costs on every PR forever.

Reserve full E2E for behavior that **only emerges from integration**. If a test can be written one layer down without losing the signal, write it there.

## Story-driven E2E

If the codebase has Storybook, a story is a mounted, dependency-wired, deterministic instance of a component - which is exactly the fixture an E2E test needs. Point Playwright at the story rather than at a route in the full app:

```ts
const BASE = 'playground-graph--full-featured';
const storyUrl = (extra?: string) =>
  `/iframe.html?id=${BASE}&viewMode=story${extra ? `&${extra}` : ''}`;
```

```ts
testMatch: '**/*.storybook.spec.ts',
webServer: { command: `npx storybook dev --port 6006 --no-open --ci`, url: baseURL, timeout: 180_000 },
```

Use `/iframe.html?id=<story>&viewMode=story` - it renders the story alone, without the Storybook chrome, so locators cannot accidentally match the sidebar or toolbar.

Why this beats routing through the app: no auth, no seeding, no navigation, deterministic props, and the failure points at one component instead of a page. It is the right default for **library and design-system code**. It cannot replace app-level E2E for routing, cross-page state, or real API integration.

Caveats: one Storybook dev server means `workers: 1` and `fullyParallel: false` unless you run against a static build (`storybook build` + serve, which parallelizes fine and is faster in CI). Story IDs are derived from title and export name, so a rename silently breaks the URL - assert something renders immediately after `goto`.

## Layered suites in one repo

Separate by filename convention and `testMatch`, not by clever config:

- `*.spec.ts` - app E2E
- `*.storybook.spec.ts` - story-driven
- `*.api.spec.ts` - API only, no browser

Each gets its own project or config with the right `webServer`.

## Test the built artifact

Run E2E against `vite preview` / `next start`, not the dev server. Dev middleware, unminified timing, and HMR sockets change behavior, and dev-only bugs waste triage time.

## What not to build

- **A POM layer by default.** See `core/fixtures-hooks.md`. Fixtures plus local helpers first; POM only for a genuinely reused multi-page flow.
- **A custom assertion DSL.** `expect(locator)` already reads well; a wrapper hides the failure message that makes Playwright debuggable.
- **A homegrown runner/reporter.** Use projects, tags, and the blob reporter.
- **Shared "test context" singletons.** They are the parallelism bug you will spend a week on.

## Ownership

Tests live beside the code they cover, owned by the team that owns the feature - not in a separate QA repo. A test suite in a different repo drifts from the app within a quarter and becomes someone else's problem, which means nobody's.
