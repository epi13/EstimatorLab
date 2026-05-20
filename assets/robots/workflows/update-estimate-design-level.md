# Update Estimate Design Level Workflow

Use this workflow when upgrading or revising an existing estimate from one design level to another, such as 30% to 65%, 65% to 95%, PER to updated PER, or 70% to final.

Use this workflow together with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`

---

## Purpose

The purpose of this workflow is to update an existing estimate using a new design package while preserving the estimate's structure and preventing missed or duplicated scope.

The existing estimate is the baseline. The new documents are the change source.

The output should make it clear what changed, what stayed the same, what was added, what was deleted, and what needs verification.

---

## Required Inputs

Use all available inputs:

- Existing estimate workbook or PDF
- New drawings
- New specifications
- New narrative
- Addenda
- Alternates
- Owner comments
- Engineer comments
- Quantity lists
- Prior assumptions
- Prior exclusions
- Project schedule information
- Updated labor, freight, escalation, or funding assumptions

If some inputs are missing, proceed with reasonable assumptions and clearly flag the limitation.

---

## Baseline Rule

Do not rebuild the estimate from scratch unless specifically requested or the new design is effectively a new design.

Start with the prior estimate and revise it.

Preserve:

- Sheet names
- Page layout
- Section titles
- Subsection titles
- Existing line item order where reasonable
- Existing formulas
- Existing HMS style
- Existing `LOT` unit convention

---

## Initial Review

Before editing, identify:

1. Prior estimate design level.
2. New design level.
3. Project location.
4. Estimate format: CSI, Uniformat, or custom workbook format.
5. Major scope areas in the old estimate.
6. Major scope areas in the new documents.
7. Alternates or phases.
8. New owner or engineer direction.
9. Known design changes.
10. Whether the new design is incremental or substantially redesigned.

---

## Change Categories

Classify every notable change as one of the following:

| Category | Meaning |
|---|---|
| Added | Scope appears in new documents but was not in prior estimate |
| Deleted | Scope was in prior estimate but is no longer shown or required |
| Revised | Scope remains but quantity, size, material, capacity, system, or method changed |
| Split | Prior broad line should be broken into multiple line items |
| Combined | Multiple prior lines are better represented as one line |
| Moved | Scope moved to another section, alternate, or phase |
| Unchanged | Scope appears generally consistent |
| Unclear | Documents conflict or do not provide enough information |

---

## Document Comparison Procedure

For each section of the existing estimate:

1. Locate the corresponding scope in the new documents.
2. Confirm whether the scope still exists.
3. Check quantity, dimensions, capacities, and specifications.
4. Check for changed materials or construction methods.
5. Check if the scope moved to an alternate or later phase.
6. Check if the scope is now owner-furnished or contractor-furnished.
7. Check for new supporting work required by the revised design.
8. Update the line item or flag it for deletion.

Then review the new documents independently to find scope not captured in the existing estimate.

---

## Quantity Update Rules

When a quantity changes:

- Update the existing line item if it is the same scope.
- Add a note describing the quantity change.
- Do not add a new line unless the scope is meaningfully different.
- If the old line was too broad, split it into clearer HMS-style line items.
- If the new quantity conflicts with plans or schedules, use best judgment and flag verification.

Example note:

```text
REVISED: Quantity updated from 420 LF to 515 LF per 65% utility plan.
```

---

## Pricing Update Rules

Update pricing when:

- Quantities changed
- Material type changed
- Equipment changed
- Capacity changed
- Design level requires more detail
- Freight route changed
- Location or logistics assumptions changed
- Construction season changed
- Labor assumptions changed
- Escalation date changed

If unit pricing remains valid, keep it and update extended totals.

If pricing is now outdated or scope is more defined, revise pricing and note the basis.

---

## Add New Scope

Add new HMS-style line items when scope is missing from the baseline estimate.

Each new line should include:

- Correct section or division
- Concise HMS-style description
- Quantity
- Unit
- Material cost
- Freight or handling assumption
- Labor cost
- Total
- Notes

Use the naming sequence:

```text
(Dimension), (Capacity), (Power), (Features) ITEM (Ancillaries)
```

---

## Delete or Remove Scope

Do not silently delete scope.

When scope appears removed:

1. Confirm it is not shown elsewhere.
2. Confirm it did not move to an alternate.
3. Confirm it is not still required by specification.
4. Mark as deleted or remove from the estimate only when reasonable.
5. Include it in the change log.

Example note:

```text
DELETED: Scope no longer shown in 95% documents; verify not included by spec narrative.
```

---

## Avoid Double Counting

Before adding new items, check whether the cost is already captured in:

- A broader existing line
- General Requirements
- A subcontractor allowance
- A system allowance
- A related division
- An alternate
- Contingency

If possible duplication exists, flag it.

Example:

```text
VERIFY: Engineer quantity may already be included in existing site utility allowance.
```

---

## General Requirements Update

Revisit General Requirements during every design-level update.

Check whether the new design affects:

- Duration
- Phasing
- Mobilization
- Remote logistics
- Travel and lodging
- Temporary facilities
- Temporary heat
- Equipment mobilization
- Material staging
- Testing coordination
- Commissioning
- Closeout

At later design levels, prefer a detailed dollar breakdown rather than only a percentage when practical.

---

## Alternates and Phasing

Review alternates carefully.

For each alternate:

- Confirm whether it still exists.
- Confirm whether it changed.
- Confirm whether it moved into base scope.
- Confirm whether base scope must be deducted when alternate is accepted.
- Keep alternate totals separate from base estimate.

Do not mix alternate scope into the base estimate unless directed.

---

## Required Change Log

Provide a change log in this format:

| Existing Line / Scope | New Document Condition | Action Taken | Quantity Change | Cost Impact | Notes |
|---|---|---|---:|---:|---|

Use action words such as:

- Updated quantity
- Added line
- Deleted line
- Split line
- Combined line
- Moved to alternate
- No change
- Needs verification

---

## Required Missing Scope Review

After updating existing lines, independently review the new drawings and specs for missing items.

Use this table:

| Source Reference | Missing Scope | Recommended Section | Quantity | Unit | Pricing Basis | Notes |
|---|---|---|---:|---|---|---|

---

## Final Quality Control

Before finalizing the update, check:

- Existing layout preserved
- Updated quantities extended correctly
- Added lines placed in correct sections
- Deleted scope documented
- Alternates separated
- General Requirements reviewed
- Freight and remote logistics reviewed
- Labor rates and productivity reviewed
- Contingencies updated if required
- No obvious duplicate scope
- All assumptions flagged

---

## Final Deliverable

The final output should include:

1. Updated estimate rows or workbook changes.
2. Change log.
3. Added scope list.
4. Deleted scope list.
5. Clarification items.
6. Assumptions and exclusions.
7. Brief summary of cost drivers.

The goal is to make the design-level update traceable and easy for an estimator to review.
