# Writing acceptance criteria (for product)

You are writing the definition of done and, simultaneously, the test plan. Anything you leave ambiguous gets decided by whoever writes the code, usually at 6pm, usually the cheap way.

## Structure

```markdown
## <Feature>

**Goal:** one sentence on the user-visible outcome.
**Out of scope:** what this explicitly does not cover.

### 1. <Layer> (blocks all)
- Given …, When …, Then …
- Given …, When …, Then …

### 2. <Layer> (blocks 3)
- …

### 3. <Layer> (independent)
- …
```

The `Out of scope` line prevents the most expensive kind of rework - the kind where engineering built the right thing plus two things nobody wanted.

## Layers, and why they are worth the extra structure

Split by the boundary a test would run against:

- **Schema / contract** - the shape both sides agree on. Almost always `blocks all`.
- **Backend** - resolvers, queries, authorization, persistence.
- **Frontend** - rendering, states, interaction.
- **Migration / rollout** - backfills, flags, backward compatibility.

The payoff: whoever reads it can see that the contract lands first, that backend and frontend can then go in parallel, and which single item is holding up the rest. It also means each criterion has an obvious test layer, which is the whole point of step 3.

## One When per criterion

If the criterion contains "and then", it is two criteria. Compound criteria produce a single test that passes when the first half works, which is how a half-finished feature ships.

```
Bad:  Given a connected integration, When the user opens the drawer and clicks Sync,
      Then the list refreshes and a toast appears.

Good: Given a connected integration, When the user opens the drawer,
      Then the environments list renders with one row per environment.
      Given an open drawer, When the user clicks Sync,
      Then lastSyncAt updates for every row.
      Given a completed sync, When it succeeds, Then a confirmation toast appears.
```

Three criteria, three tests, three things that can independently be broken or done.

## Be specific about data

Name the fields. Name the counts. Name the codes.

```
Weak:   Then all environments are returned.
Strong: Given a tenant with an integration having N environment rows,
        When the environments query runs,
        Then all N are returned, scoped to the requesting tenant only.
```

`N` is fine - it says "all of them, not a page" without inventing a number. What is not fine is leaving out `scoped to the requesting tenant only`, because that is the difference between a feature and a data leak.

## Say what should NOT happen

Negative criteria are where the bugs live and they are almost always missing:

```
Given tenant A's credentials, When querying tenant B's integration,
Then no data is returned (403, or an empty result - pick one and say which).
```

Note the parenthetical. "Returns an error or nothing" is not a criterion, because two implementations both satisfy it and one of them leaks resource existence. Decide, and write the decision down.

## Backward compatibility is a criterion, not an assumption

Any change to an existing contract needs an explicit criterion for the old shape:

```
Given a legacy single-environment integration,
When the environments query runs,
Then exactly one environment is returned with all five fields populated.
```

Without this line, "we support multiple environments now" ships and every pre-migration record returns an empty list.

## Non-functional requirements

Write them as budgets with numbers, in the same list:

```
Given an integration with 1,000 environments, When the query runs,
Then the response returns in under 200ms at p95.
```

"Should be fast" is not testable and will not be tested.

## Definition of Done vs acceptance criteria

Keep them separate:

- **Acceptance criteria** - specific to this feature. Change every story.
- **Definition of Done** - the standing bar for all work (reviewed, typechecked, tested, documented, deployed behind a flag). Written once, referenced.

Repeating the DoD inside every story's criteria trains people to skim the list, and then they skim the part that mattered.

## Checklist before you hand it over

- [ ] Every criterion is Given/When/Then with one When.
- [ ] Every list-returning criterion says empty vs null vs error.
- [ ] Multi-tenant or multi-user? There is an isolation criterion.
- [ ] Changing an existing contract? There is a backward-compatibility criterion.
- [ ] Every layer group declares what it blocks.
- [ ] No "correctly", "properly", "as expected", "handles".
- [ ] Out of scope is written down.
- [ ] Run [coverage-checklist.md](coverage-checklist.md).
