---
name: acceptance-criteria-tdd
description: Use when writing acceptance criteria, a Definition of Done, or story requirements for a feature, and when turning those criteria into failing test skeletons before implementation. Covers Given/When/Then grammar, splitting criteria by layer (schema, backend, frontend) with explicit blocking order, the coverage checklist for cases teams forget (empty results, tenant isolation, backward compatibility, error paths), and generating one test stub per criterion so the suite starts red.
---

# Acceptance Criteria and TDD

One artifact, two readers. Product writes criteria that are precise enough to be executable. Engineering turns each criterion into exactly one failing test, then makes it pass.

The contract: **every acceptance criterion becomes one test. If a criterion cannot become a test, it is not a criterion yet.**

## Workflow

1. **Product** drafts criteria grouped by layer, in blocking order. → [writing-acceptance-criteria.md](references/writing-acceptance-criteria.md)
2. **Run the coverage checklist.** Most gaps are the same handful of forgotten cases. → [coverage-checklist.md](references/coverage-checklist.md)
3. **Engineering** scaffolds one stub per criterion, all failing. → [ac-to-test-skeleton.md](references/ac-to-test-skeleton.md)
4. Implement until green. A criterion with no failing test at the start was never verified.

Start from [templates/acceptance-criteria.md](templates/acceptance-criteria.md). A full worked example is in [examples/environments-feature.md](examples/environments-feature.md).

## The grammar

```
Given <starting state>, When <action>, Then <observable outcome>.
```

- **Given** - the state that must already exist. Data, role, config, feature flag.
- **When** - one action. If you need "and then", split the criterion.
- **Then** - what an observer can check. A value, a status code, a rendered element, a stored row.

The test for `Then` writes itself: arrange the Given, perform the When, assert the Then.

## Group by layer, declare the blocking order

```markdown
### 1. GraphQL Schema (blocks all)
### 2. Backend: environments query resolver (blocks 3)
### 3. Frontend: environments list
```

Two reasons this matters. Product sees what ships in what order and can cut a layer. Engineering sees the dependency graph without a meeting - the layer marked `blocks all` is the one to land first, and the rest can be parallelized behind it.

Name the blocking relationship explicitly (`blocks all`, `blocks 3`, `independent`). "Ordered list" is not a dependency statement.

## The quality bar

A criterion is done when it is:

- **Observable.** Names something a test can read. Not "the query is efficient" - that is a non-functional requirement, write it as a budget: "returns in under 200ms for 1,000 rows".
- **Singular.** One Given, one When, one Then. Compound criteria hide half-implemented features behind a passing test.
- **Absolute.** No "correctly", "properly", "as expected", "handles". These push the decision to whoever writes the test, and it gets decided by accident.
- **Falsifiable.** You can state the input that makes it fail.

Rewrite examples:

| Vague | Executable |
|---|---|
| Returns the right fields | Returns `id`, `name`, `environmentType`, `status`, `lastSyncAt` |
| Handles empty state | Given zero environments, returns `[]` - not `null`, not an error |
| Is secure | Given tenant A's token, querying tenant B's integration returns 403 and no data |
| Backward compatible | Given a pre-migration single-environment integration, returns exactly one environment with all five fields populated |

## Null, empty, and error are three different outcomes

The most common under-specification. Say which one:

> Given an integration with zero environments, When queried, Then returns an empty list - **not null, not an error**.

Empty-vs-null crashes clients that map over the result, and it is invisible until production data has an empty case. Write it as a criterion every time a list is returned.

## What belongs in criteria and what does not

**In:** observable behavior, contracts, states, permissions, error responses.

**Out:** implementation choices (which table, which library, which hook), and anything the team's engineering standards already mandate (typecheck passes, tests exist, lint is clean). Repeating standards as criteria dilutes the list; the reader stops reading.

A criterion that names a file or a function is a design note, not a criterion. Move it below the list.

## Generating the skeletons

One `it`/`test` per criterion, titled with the criterion, body failing. See [ac-to-test-skeleton.md](references/ac-to-test-skeleton.md).

```ts
describe('AC 1: GraphQL schema', () => {
  it('returns environments with id, name, environmentType, status, lastSyncAt', async () => {
    expect.fail('not implemented');
  });

  it('returns [] - not null, not an error - when the integration has zero environments', async () => {
    expect.fail('not implemented');
  });
});
```

Run them. A green stub means the criterion is untested - fix the stub before writing production code.

Keep the AC numbering in the test titles. When a criterion changes, the test to update is unambiguous, and a reviewer can diff the list against the suite.
