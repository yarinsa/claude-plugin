---
name: qa-playwright-tests
description: Use when writing, reviewing, or fixing Playwright tests - E2E, component, API, GraphQL, visual, accessibility, security, or performance. Covers locators and auto-waiting, fixtures over Page Object Model, test data and isolation, flaky-test diagnosis, trace debugging, network mocking, authentication and storage state, clock mocking, multi-user contexts, mobile and responsive, i18n and RTL, canvas/Electron/extension targets, config, sharded CI with blob reports, and reporting.
---

# Playwright Test Practices

Opinionated guidance. Where a tradeoff has a defensible default, this skill states it rather than listing options.

## The rules that matter most

1. **`await expect(locator)`, never `expect(await locator…)`.** Web-first assertions retry; snapshot assertions race. This single distinction removes most flakiness.
2. **No `waitForTimeout`.** One exception: a documented, bounded debounce window with no observable end state. Name the constant in a comment.
3. **`getByRole` first.** If a control has no role, fix the markup instead of reaching for CSS.
4. **Fixtures over Page Object Model.** Playwright's API needs no wrapper; fixtures compose and have teardown.
5. **Every test owns its data**, creates it via API, and removes it in fixture teardown.
6. **Seed via API, act via UI.** Never drive the login form to reach a precondition.
7. **Retries report flakes; they do not fix them.** `retries: 0` locally.
8. **Push tests down a layer** whenever the layer below can catch the same bug.

## Where to look

### Writing tests

| Task | Read |
|---|---|
| Choosing selectors | [core/locators.md](references/core/locators.md) |
| Waiting, assertions, timeouts | [core/assertions-waiting.md](references/core/assertions-waiting.md) |
| Setup, teardown, fixtures, POM question | [core/fixtures-hooks.md](references/core/fixtures-hooks.md) |
| File layout, naming, test shape | [core/test-suite-structure.md](references/core/test-suite-structure.md) |
| Factories, determinism, cleanup | [core/test-data.md](references/core/test-data.md) |
| Component tests | [testing-patterns/component-testing.md](references/testing-patterns/component-testing.md) |
| API tests, authorization, tenancy | [testing-patterns/api-testing.md](references/testing-patterns/api-testing.md) |
| GraphQL | [testing-patterns/graphql-testing.md](references/testing-patterns/graphql-testing.md) |
| Forms and validation | [testing-patterns/forms-validation.md](references/testing-patterns/forms-validation.md) |
| Visual regression | [testing-patterns/visual-regression.md](references/testing-patterns/visual-regression.md) |
| Accessibility | [testing-patterns/accessibility.md](references/testing-patterns/accessibility.md) |
| Security | [testing-patterns/security-testing.md](references/testing-patterns/security-testing.md) |
| Performance budgets, Web Vitals | [testing-patterns/performance-testing.md](references/testing-patterns/performance-testing.md) |
| i18n, RTL, formatting | [testing-patterns/i18n.md](references/testing-patterns/i18n.md) |
| Canvas, WebGL, Electron, extensions | [testing-patterns/specialized-targets.md](references/testing-patterns/specialized-targets.md) |

### Architecture

| Task | Read |
|---|---|
| Which layer should this test live in; story-driven E2E | [architecture/test-architecture.md](references/architecture/test-architecture.md) |
| Mock or hit the real thing | [architecture/when-to-mock.md](references/architecture/when-to-mock.md) |

### Advanced

| Task | Read |
|---|---|
| Login, storage state, roles, feature flags | [advanced/authentication.md](references/advanced/authentication.md) |
| Route interception, HAR, request assertions | [advanced/network-mocking.md](references/advanced/network-mocking.md) |
| Time, timers, debounce, session expiry | [advanced/clock-mocking.md](references/advanced/clock-mocking.md) |
| Multiple users, tabs, popups, dialogs | [advanced/multi-context.md](references/advanced/multi-context.md) |
| Device emulation, touch, breakpoints | [advanced/mobile-testing.md](references/advanced/mobile-testing.md) |
| Permissions, geolocation, clipboard, iframes, websockets, service workers, upload/download | [advanced/browser-apis.md](references/advanced/browser-apis.md) |

### When something is wrong

| Symptom | Read |
|---|---|
| Test fails and I do not know why | [debugging/debugging.md](references/debugging/debugging.md) |
| Passes sometimes | [debugging/flaky-tests.md](references/debugging/flaky-tests.md) |
| Passes alone, fails in the suite | [debugging/flaky-tests.md](references/debugging/flaky-tests.md), [core/fixtures-hooks.md](references/core/fixtures-hooks.md) |
| Element not found | [core/locators.md](references/core/locators.md), [debugging/debugging.md](references/debugging/debugging.md) |
| Timeouts | [core/assertions-waiting.md](references/core/assertions-waiting.md) |
| JS errors leaking through green tests | [debugging/console-errors.md](references/debugging/console-errors.md) |
| Error states, empty states, offline, retry | [debugging/error-testing.md](references/debugging/error-testing.md) |

### Infrastructure

| Task | Read |
|---|---|
| Config, projects, webServer | [core/configuration.md](references/core/configuration.md) |
| Auth setup project, dependencies, teardown | [core/global-setup-projects.md](references/core/global-setup-projects.md) |
| Skip/fixme/fail, tags, filtering | [core/annotations-tags.md](references/core/annotations-tags.md) |
| CI, sharding, blob reports, caching | [infrastructure/ci-cd.md](references/infrastructure/ci-cd.md) |
| Workers, shards, suite speed | [infrastructure/parallel-performance.md](references/infrastructure/parallel-performance.md) |
| Reporters, artifacts, coverage | [infrastructure/reporting-coverage.md](references/infrastructure/reporting-coverage.md) |

## Validation loop

```bash
npx playwright test --reporter=list
npx playwright test --ui                  # primary local workflow
npx playwright show-trace <trace.zip>     # on failure
npx playwright test <file> --repeat-each=10   # before calling a flake fixed
```

Never mark a flaky test fixed without a repeat run. Never raise a timeout to make a failure go away.

## Related

For driving a browser interactively from the shell - screenshots, DOM inspection, manual QA - see the `qa-playwright-cli` skill in this plugin. This skill is about the test suite; that one is about live browser control.
