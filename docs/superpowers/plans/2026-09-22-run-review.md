# Scenario review implementation plan

> Execute the approved change in this session, with an independent code review before completion.

**Goal:** Make the required review discoverable at the run action while preserving per-scenario state.

**Architecture:** index.html owns the review region; app.js renders stable scenario rows and binds review/edit actions. Existing validation and serialization remain authoritative. Browser checks exercise real UI interactions at both deployed paths.

**Tech Stack:** Static HTML/CSS, ES modules, Node test runner and Playwright.

- [x] Extend scripts/browser-tests.mjs with scripts/review-browser-checks.mjs. Observe missing review UI fail before implementation.
- [x] Move the checkbox out of the scenario form into a per-scenario list below runbar. Display values and evidence, retain focus across renders, resolve edits by scenario ID and preserve all validation gates.
- [x] Update tour and Learn guidance plus all current documentation describing this workflow. Keep dated historical artifacts labeled as such.
- [x] Run npm test, npm run test:browser, syntax and diff checks. Inspect desktop/mobile rendering, review changes independently and record executed evidence in docs/VERIFICATION.md.
