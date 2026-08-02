# From criteria to failing tests (for engineers)

## The mapping

| AC part | Test part |
|---|---|
| Group heading | `describe('AC <n>: <layer>')` |
| Given | arrange |
| When | act |
| Then | assert |
| Criterion text | test title, near-verbatim |

One criterion, one test. Not one test covering three criteria, and not four tests for one criterion - the counts should match so a reviewer can diff the list against the suite.

## Step 1: stub everything, red

```ts
describe('AC 1: GraphQL schema (blocks all)', () => {
  it('returns environments with id, name, environmentType, status, lastSyncAt', async () => {
    expect.fail('not implemented');
  });

  it('returns [] - not null, not an error - when the integration has zero environments', async () => {
    expect.fail('not implemented');
  });
});

describe('AC 2: environments query resolver', () => {
  it('returns all N environments scoped to the requesting tenant', async () => {
    expect.fail('not implemented');
  });

  it('returns no data when tenant A queries tenant B integration', async () => {
    expect.fail('not implemented');
  });

  it('returns exactly one populated environment for a legacy single-environment integration', async () => {
    expect.fail('not implemented');
  });
});
```

`expect.fail()` (vitest/jest) or `test.fail()` (Playwright) - not `it.todo`. A todo reports as skipped, and skipped is indistinguishable from absent in a CI summary. You want the count of failing tests to equal the count of criteria on day one.

**Run them before writing any production code.** Any stub that passes is a stub asserting nothing.

## Step 2: fill in arrange/act/assert, still red

```ts
it('returns no data when tenant A queries tenant B integration', async () => {
  const { tenantA, tenantB } = await seedTwoTenants();          // Given
  const integration = await seedIntegration(tenantB, { environments: 2 });

  const res = await query(ENVIRONMENTS, { id: integration.id }, tenantA.token);   // When

  expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');  // Then
  expect(res.data?.integration).toBeNull();
});
```

Now it fails for the right reason - the behavior is missing, not the test. That distinction is the whole value of the step.

## Step 3: implement one criterion at a time

Green one test, run the suite, move on. Do not batch - implementing three criteria at once and then debugging which of the three broke is how TDD stops being worth it.

## Picking the layer

The AC group usually names it:

| Group | Test type |
|---|---|
| Schema / contract | Contract test or typecheck against the generated schema |
| Backend resolver, authorization, tenancy | Integration test against a real database |
| Business rules, pure logic | Unit test |
| Rendering, states, interaction | Component test |
| Cross-layer user journey | E2E - sparingly |

Push down whenever the layer below can catch the same failure. A tenancy criterion needs a real database; a formatting criterion does not need a browser.

## Assert the criterion, not the implementation

```ts
// Restates the code. Passes when the behavior is wrong.
expect(repo.find).toHaveBeenCalledWith({ tenantId });

// Asserts the criterion.
expect(result.map((e) => e.id)).toEqual([envA1, envA2]);
```

The mock-call assertion tests the library. If the query is right but the mapping drops a row, it still passes.

## Empty, null, and error are separate tests

```ts
it('returns [] when the integration has zero environments', async () => {
  const res = await query(ENVIRONMENTS, { id: empty.id }, token);
  expect(res.errors).toBeUndefined();
  expect(res.data.integration.environments).toEqual([]);   // not toBeNull, not toHaveLength(0)
});
```

`toEqual([])` distinguishes empty from null; `toHaveLength(0)` throws confusingly on null and `toBeFalsy()` accepts both. Precision here is the point of the criterion.

## Keep the numbering

`describe('AC 2: …')` costs nothing and pays every time criteria change: the test to update is unambiguous, a reviewer can check coverage by counting, and a deleted criterion leaves an obviously orphaned describe block.

## Definition of done for the scaffold

- [ ] Test count equals criterion count.
- [ ] Every test failed before implementation started.
- [ ] Each test title is traceable to its criterion.
- [ ] No test asserts on a mock call instead of an outcome.
- [ ] Tenancy and backward-compatibility criteria run against a real database.
