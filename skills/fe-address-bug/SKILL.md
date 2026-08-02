---
name: fe-address-bug
description: Disciplined bug-fixing loop - prove the root cause and get it approved before writing code, capture the bug in a failing test, fix, re-run the same assertion, then sweep for other code paths with the same defect. Invoke when fixing a reported bug, investigating a regression, or when the user says "fix this bug", "why is this broken", or hands over a stack trace or repro steps.
---

# Addressing a Bug

Five steps, in order. Step 1 ends with a human decision. Do not write a fix before that approval exists.

The failure mode this exists to prevent: patching the first line that makes the symptom disappear, shipping it, and finding out later that the real defect was one layer up and still lives in four other call sites.

## 1. Find the root cause and prove it

Reproduce first. A bug you have not reproduced is a hypothesis about someone else's environment.

Trace from the symptom back to the line that is actually wrong. Stop when you can state the defect as a mechanism, not a location. "The list renders stale rows" is a symptom. "`useEffect` omits `filters` from its dependency array, so the fetch never re-runs when a filter changes" is a root cause.

**Prove it before believing it.** Acceptable proof, cheapest first:

- A log or breakpoint showing the wrong value at the moment it is produced.
- Flipping the suspected input and watching the symptom follow it.
- A minimal snippet that reproduces the mechanism in isolation.

Reading the code and finding something that looks wrong is not proof. Plausible-looking causes next to the real one are the normal case, not the exception.

**Then stop and report to the human.** Present:

- The symptom, and the exact steps that reproduce it.
- The root cause, stated as a mechanism, with the file and line.
- The evidence that proves it, not just asserts it.
- The proposed fix, in one or two sentences.
- The blast radius: what else touches this code.

If you found more than one plausible cause, say so and say which one the evidence supports. If you could not prove it, say that too and present the leading hypothesis as a hypothesis. Guessing confidently is worse than reporting uncertainty.

**Wait for approval.** The human may know the "wrong" behavior is deliberate, may want the fix somewhere else, or may want the whole shape reconsidered. That call is theirs and it is much cheaper before the code exists.

## 2. Write a test that fails

One test, reproducing this bug through the mechanism you proved, at the lowest layer that exhibits it. A unit test beats an integration test beats an E2E test when all three would catch it.

**Run it and watch it fail.** Confirm it fails for the reason you expect. A test that passes before the fix proves nothing, and a test that fails for an unrelated reason (a typo, a missing mock) will keep passing after the fix and give you false confidence forever.

Name it after the behavior, not the ticket. `does not refetch when the filter changes` outlives `fixes ENG-1423`.

Assert the observable outcome. Not that a function was called - that the user or caller sees the right thing.

## 3. Apply the fix

Fix the root cause, at the layer where it is wrong. If the defect is in a shared helper, fix the helper rather than guarding at one call site.

Minimal change. A bug fix does not license cleaning up the surrounding file, renaming things, or adding the configurability you wish were there. If you spot something else broken nearby, note it for step 5 and leave it alone.

Before adding a lock, retry, guard, or flag, name the existing safeguard and say why it does not cover this case. Most bugs are a missing condition, not a missing mechanism.

## 4. Re-run the same assertion

The same test, unchanged. If you had to edit the test to make it pass, either the test was wrong or the fix is wrong - work out which, and say which in your report.

Then run the surrounding suite. A fix that turns one red test green and another green test red is not a fix.

Report the actual output. If something still fails, say so and show it.

## 5. Sweep for the same defect elsewhere

The bug you fixed is usually an instance of a pattern, not a one-off.

Search deliberately, at least these three ways:

- **The same mechanism.** If the cause was a missing dependency in `useEffect`, grep the other effects in that area. If it was an unhandled null from one endpoint, check the other endpoints in that module.
- **The same call sites.** Everything that calls the function you changed. Verify each one wanted the new behavior - a caller that depended on the buggy behavior is now itself a bug.
- **The same author-intent.** Copy-pasted siblings. The block you fixed was very often duplicated.

Report each candidate with a verdict: same bug, adjacent risk, or clean. Do not silently fix them - that turns a reviewable one-line diff into a sprawl.

Then propose coverage for what the sweep exposed:

- **Small and in scope** (one or two more tests over code you already touched): offer to add them now.
- **Large scope** (a whole module unprotected, a systemic pattern across many files, a refactor the fix has revealed as necessary): do not absorb it into this fix. Propose a separate ticket - Linear or whatever the team uses - with a title, the pattern found, the affected areas, and why it is worth doing. Say plainly that it is out of scope for this change.

Scaling the work up is the human's call, not yours.

## Reporting

Structure the final report around the five steps. State the root cause and evidence, the test that proved it, the fix, the verification result, and the sweep verdicts with any proposed follow-up.

Never report a bug as fixed on the strength of a test you did not run.

## Related

- `qa-playwright-tests` for the failing test when the bug only reproduces in a browser.
- `qa-playwright-cli` for driving a live browser during step 1 reproduction.
- `fe-react-patterns` when the root cause turns out to be structural rather than a single wrong line.
