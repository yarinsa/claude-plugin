# Coverage checklist

Run this against a draft before engineering picks it up. The gaps are nearly always from this list.

## Cardinality

- [ ] **Zero** - and is the answer `[]`, `null`, or an error? Say which.
- [ ] **Exactly one** - singular copy, and layouts that assumed a list.
- [ ] **Many** - is there a limit? What happens at limit+1?
- [ ] **Page boundaries** - exactly page-size, page-size+1, last page, stale cursor.

## Authorization and tenancy

- [ ] Each role that should have access.
- [ ] Each role that should **not** - and the exact response (403 vs 404 vs empty).
- [ ] **Cross-tenant**: tenant A requesting tenant B's resource by direct ID.
- [ ] Unauthenticated.
- [ ] Hidden in the UI is not the same as forbidden by the API. Both need a criterion.

Cross-tenant is the one most often missing and the most expensive to miss - it is invisible in every UI test.

## Backward compatibility

- [ ] Records created before this change.
- [ ] Clients on the previous contract version.
- [ ] Nullable field becoming non-nullable, or a scalar becoming a list.
- [ ] What happens mid-rollout, when both shapes exist at once.

## Error paths

- [ ] Upstream dependency down or timing out.
- [ ] Malformed input - and does the error name the offending field?
- [ ] Conflict - two writers, same resource.
- [ ] Partial failure - three of five items succeed. Is that a success, a failure, or a partial?
- [ ] Rate limited.
- [ ] No stack traces, driver errors, or internal IDs in error responses.

## State transitions

- [ ] Every legal transition.
- [ ] At least one illegal transition, and its rejection.
- [ ] Repeating an action - is it idempotent?
- [ ] Cancel or undo mid-flight.

## Frontend states

- [ ] Loading - skeleton or spinner.
- [ ] Empty - and is the message actionable, with the primary action visible?
- [ ] Error - and can the user retry? Does the error clear after a successful retry?
- [ ] Stale or refreshing while showing old data.
- [ ] Long values - overflow, truncation, unicode, RTL.

## Data quality

- [ ] Nullable fields that are actually null.
- [ ] Timezone-sensitive values.
- [ ] Sort order - is it specified, or accidental?
- [ ] Duplicates - possible, and if so what wins?

## Observability

- [ ] Is the event fired after the action **succeeds**, not on intent? A failed attempt counted as a success corrupts the metric permanently.
- [ ] Does a failure surface somewhere an operator sees it?

## Non-functional

- [ ] Response-time budget with a number and a percentile.
- [ ] Payload or result-set size ceiling.
- [ ] Behavior under the largest realistic dataset, not the demo one.

## Scope

- [ ] Written down what this explicitly does not do.
- [ ] Every criterion is observable, singular, and falsifiable.
- [ ] No criterion names a file, table, or function.

## Using this on an existing draft

Do not add a criterion for every unchecked box - that produces a 60-item list nobody reads. Walk the list, and for each gap decide: **add a criterion**, or **write it under Out of scope**. Both are answers. Silence is not.
