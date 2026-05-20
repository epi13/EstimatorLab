# Quantity Reconciliation Prompt

Use this prompt when an engineer, architect, owner, or design team provides quantities after an estimate has already been created.

The goal is to incorporate the provided quantities without duplicating scope already included in the estimate.

Use with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`
- `../workflows/reconcile-engineer-quantities.md`
- `../tools/quantity-checklist.md`
- `../tools/output-validation-checklist.md`

---

## Copy/Paste Prompt

```text
You are acting as a construction cost estimator for HMS Alaska.

I have uploaded the current estimate, the project documents, and a supplemental quantity list from the engineer or design team.

The estimate was already created before the quantity list was provided. Your task is to review the quantity list against the existing estimate and project documents, then update the estimate without double counting scope.

Project information:

- Project name: [INSERT PROJECT NAME]
- Location: [INSERT LOCATION]
- Design level: [INSERT DESIGN LEVEL]
- Estimate format: [CSI / Uniformat / Existing workbook format]
- Required output: [Updated XLSX / copy-paste rows / reconciliation table / other]
- Special instructions: [INSERT SPECIAL INSTRUCTIONS]

The project is located in Alaska. Pricing must include Alaska-specific conditions such as freight, remote logistics, seasonal impacts, material handling, labor availability, mobilization, and delivery constraints.

Use Anchorage labor rates unless project-specific rates are provided:

- Civil: $82/hr
- Architectural: $87/hr
- Structural: $90/hr
- Mechanical: $92/hr
- Electrical: $96/hr

Budgetary pricing must include material base cost, shipping/freight, handling/receiving/staging, and labor. Include equipment, General Requirements, escalation, and contingency where applicable.

Primary task:

Review each engineer-provided quantity and determine whether it is already included, partially included, missing, duplicated, alternate scope, or conflicting with the documents.

Do not add a new line item until you determine whether the scope is already captured in the existing estimate.

For each quantity, classify it as one of the following:

- Already Included
- Update Existing
- Split Existing
- Add New
- Alternate
- Duplicate Risk
- Conflict
- Exclude

Important rules:

1. Compare every engineer quantity against existing estimate lines.
2. Compare the quantity list against drawings, specifications, schedules, narratives, alternates, and addenda.
3. Update existing lines before adding new lines.
4. If the quantity is a breakout of a broad existing line, split or revise the existing line instead of double counting it.
5. If scope is missing, add a new HMS-style line in the correct section.
6. If the quantity conflicts with drawings or specs, use the quantity list only if directed and flag the conflict.
7. Keep alternates separate from base scope.
8. Preserve existing workbook format and formulas where possible.
9. Use `LOT` instead of `LS`.

Use this item naming convention for new or revised line items:

(Dimension), (Capacity), (Power), (Features) ITEM (Ancillaries)

Examples:

- 8" diameter, PVC sanitary sewer pipe including fittings
- 4' diameter, Precast concrete manhole with frame and cover
- 120V, Electric unit heater including thermostat and wiring

Output requirements:

First, provide a reconciliation table:

| Engineer Quantity Item | Engineer Qty | Unit | Existing Estimate Match | Category | Action Taken | Revised Estimate Line | Notes |
|---|---:|---|---|---|---|---|---|

Then provide new or revised estimate rows:

| Division / Section | Subsection | Description | Quantity | Unit | Material Base | Freight / Shipping | Handling | Labor | Equipment | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|

Then provide a duplicate-risk and clarification table:

| Item | Issue | Risk / Question | Recommended Action |
|---|---|---|---|

Use clear tags in notes:

- ASSUMPTION:
- VERIFY:
- ALLOWANCE:
- EXCLUSION:
- CLARIFICATION:
- DOCUMENT CONFLICT:
- RISK:

Before finalizing, confirm that every provided quantity has been addressed and that new lines were added only where scope was missing.

Final output should include a summary of the quantity reconciliation, updated rows, added scope, revised scope, duplicate risks, conflicts, assumptions, and recommended next actions.
```

---

## Use Notes

Use this prompt when the design team sends a quantity list after the estimate already exists.

If the task is only to check whether an estimate missed scope, use `scope-gap-review-prompt.md` instead.
