## What changed

A sentence or two, plus the issue this closes if there is one.

## Why

The decision or defect behind it.

## Verification

Paste what you actually ran and what it printed. Assertions without output are not verification.

- [ ] `npm test` (state the pass count)
- [ ] Exercised the change in a browser against real data, not only in tests
- [ ] If a model number moved: the before and after values, and the reason the new one is right

```
paste command output here
```

## Claims

- [ ] No new unlabeled number. Every value added to the interface, an export or a document carries its source or is marked an assumption.
- [ ] No invented data. Missing stays missing; nothing is filled by a nearest value, a previous year or a default.
- [ ] The evidence tier is unchanged, or the evidence to raise it is in this pull request.
- [ ] Any published figure this change moves is updated in the document that quotes it.

## Housekeeping

- [ ] No new runtime dependency, no build step
- [ ] Tests added only where a plausible bug would fail them, and removed where they pinned wording or implementation
- [ ] `CHANGELOG.md` updated under Unreleased
- [ ] No em dashes in new copy
