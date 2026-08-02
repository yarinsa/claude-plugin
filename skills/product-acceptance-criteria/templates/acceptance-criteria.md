# <Feature name>

**Goal:** <one sentence, user-visible outcome>

**Out of scope:** <what this explicitly does not cover>

---

## Acceptance criteria

### 1. <Contract / schema layer> (blocks all)

- Given <state>, When <action>, Then <observable outcome>.
- Given <the empty case>, When <action>, Then returns <empty list / null / error - pick one>.

### 2. <Backend layer> (blocks 3)

- Given <state>, When <action>, Then <outcome>, scoped to the requesting tenant only.
- Given <tenant A credentials>, When <querying tenant B resource>, Then <403 / 404 / empty - pick one> and no data.
- Given <a legacy / pre-migration record>, When <action>, Then <backward-compatible outcome>.

### 3. <Frontend layer> (independent)

- Given <loading>, When <the page opens>, Then <skeleton is shown>.
- Given <zero results>, When <the page opens>, Then <empty state with its primary action>.
- Given <a failed request>, When <the page opens>, Then <error with retry>; When <retry succeeds>, Then <the error clears>.

### 4. Non-functional

- Given <N records>, When <action>, Then response completes in under <X>ms at p95.

---

## Notes for engineering

<Design notes, links, known constraints. Not criteria - these do not become tests.>

---

## Checklist

- [ ] Every criterion is Given / When / Then with exactly one When.
- [ ] Every list result says empty vs null vs error.
- [ ] Tenant / role isolation covered.
- [ ] Backward compatibility covered.
- [ ] Each group declares what it blocks.
- [ ] No "correctly", "properly", "as expected", "handles".
- [ ] Coverage checklist run.
