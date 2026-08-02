# Worked example: multi-environment support for integrations

An integration used to have one environment. It now has many. This is the full path from a rough draft to a red test suite.

## The draft that arrived

> - Client can query integration.environments and get the environments back with their fields.
> - Empty case handled.
> - Environments query returns the data, scoped properly.
> - Tenant A shouldn't see tenant B.
> - Legacy integrations still work.

Everything important is present in outline. Nothing is testable: "their fields", "handled", "scoped properly", "shouldn't see", "still work" each hide a decision.

## After the rewrite

```markdown
# Multi-environment support for integrations

**Goal:** an integration exposes all of its environments, so users can see per-environment
sync status instead of a single aggregate.

**Out of scope:** creating, renaming, or deleting environments; per-environment
permissions; the environment picker in the header.

### 1. GraphQL schema (blocks all)

- Given a connected integration, When a client queries `integration.environments`,
  Then the schema returns a list of environments, each with `id`, `name`,
  `environmentType`, `status`, and `lastSyncAt`.
- Given an integration with zero environments, When queried,
  Then the field returns an empty list - not null, and not an error.

### 2. Backend: environments query resolver (blocks 3)

- Given a tenant with an integration having N environment rows,
  When the environments query runs,
  Then all N are returned, scoped to the requesting tenant only.
- Given tenant A's credentials, When querying an integration belonging to tenant B,
  Then the response is a FORBIDDEN error with `data.integration` null.
- Given a legacy single-environment integration created before the migration,
  When the environments query runs,
  Then exactly one environment is returned with all five fields populated.
- Given an integration with 1,000 environments, When the query runs,
  Then it completes in under 200ms at p95.

### 3. Frontend: environments list (independent)

- Given the query is in flight, When the drawer opens, Then a skeleton row renders.
- Given zero environments, When the drawer opens,
  Then the empty state renders with the "Connect an environment" action visible.
- Given the query fails, When the drawer opens, Then an error with a Retry action renders;
  When Retry succeeds, Then the error clears and rows render.
```

## What the rewrite changed

- **"their fields" → five named fields.** Now a missing field fails a test instead of being noticed in review, or not.
- **"Empty case handled" → empty list, not null, not error.** The original passes with any of the three, and one of them crashes every client that maps the result.
- **"scoped properly" → scoped to the requesting tenant only.** The security property is now a stated outcome.
- **"shouldn't see" → FORBIDDEN with null data.** The draft is satisfied by returning 404, by returning an empty list, or by throwing - and those leak different amounts about whether tenant B's integration exists. Someone has to decide; better product than a resolver at 6pm.
- **"still work" → exactly one environment, all five fields populated.** This is the criterion that stops the release where every pre-migration record returns `[]`.
- **Added a latency budget and the three frontend states.** Absent from the draft, and each is a real defect if wrong.
- **Added Out of scope.** The draft invites someone to build an environment picker.

## The scaffold

```ts
describe('AC 1: GraphQL schema (blocks all)', () => {
  it('exposes integration.environments with id, name, environmentType, status, lastSyncAt', async () => {
    expect.fail('not implemented');
  });

  it('returns [] - not null, not an error - for an integration with zero environments', async () => {
    expect.fail('not implemented');
  });
});

describe('AC 2: environments query resolver', () => {
  it('returns all N environments scoped to the requesting tenant', async () => {
    expect.fail('not implemented');
  });

  it('returns FORBIDDEN with null data when tenant A queries a tenant B integration', async () => {
    expect.fail('not implemented');
  });

  it('returns exactly one populated environment for a legacy single-environment integration', async () => {
    expect.fail('not implemented');
  });

  it('completes in under 200ms at p95 for 1,000 environments', async () => {
    expect.fail('not implemented');
  });
});

describe('AC 3: environments list', () => {
  it('renders a skeleton row while the query is in flight', async () => {
    expect.fail('not implemented');
  });

  it('renders the empty state with the Connect an environment action', async () => {
    expect.fail('not implemented');
  });

  it('renders an error with Retry, and clears it when the retry succeeds', async () => {
    expect.fail('not implemented');
  });
});
```

Nine criteria, nine tests, nine failures. Run it and confirm the count matches before anyone writes a resolver.

## Filling in AC 2's tenancy test

```ts
it('returns FORBIDDEN with null data when tenant A queries a tenant B integration', async () => {
  const { tenantA, tenantB } = await seedTwoTenants();
  const integration = await seedIntegration(tenantB, { environments: 2 });

  const res = await query(ENVIRONMENTS_QUERY, { id: integration.id }, tenantA.token);

  expect(res.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  expect(res.data?.integration).toBeNull();
});
```

Against a real database, not a mocked repository - the criterion is about what the query returns, and a mocked repo would assert the code we are about to write rather than the behavior we promised.

## Order of work

AC 1 blocks everything, so the schema lands first. AC 2 and AC 3 then proceed in parallel, with the frontend working against mocked responses shaped by the AC 1 contract - which is safe precisely because the contract is now written down and tested.
