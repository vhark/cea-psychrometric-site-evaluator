---
name: Bug report
about: A wrong number, a broken interaction, a missing caveat or an overstated claim
title: ''
labels: bug
assignees: ''
---

## What happened

Describe the behaviour you saw.

## What you expected, and why

If this is a wrong number, say what it should be and where that expectation comes from: a hand calculation, a psychrometric chart, a published figure, another tool. "It looks too high" is a fine starting point, but the basis helps.

## Reproduction

1. 
2. 
3. 

**Scenario:** attach the exported scenario JSON, or the run JSON if the problem only appears after a run. Replace confidential values before attaching; a scenario with substituted numbers usually reproduces the same defect.

**Weather:** bundled climate-archetype year / NASA POWER retrieval / station observations / imported file (delete as appropriate). Give the location and date range.

## Environment

- Model version (shown in the footer and in every export): 
- Browser and version: 
- How you served it (`python3 -m http.server`, GitHub Pages, other static host): 

## Overstated claim reports

If the problem is that the tool, a document or an export claims more than the evidence supports, say which sentence and which evidence. These are treated as defects, not as opinions, and they are welcome.
