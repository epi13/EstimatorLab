# VE Pricing Prompt

Use this prompt when pricing value engineering items, owner-requested alternates, design-team cost options, or highlighted VE spreadsheet cells.

This prompt is intended to produce clear add/deduct pricing with assumptions, exclusions, and scope boundaries.

Use with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`
- `../workflows/value-engineering-review.md`
- `../tools/estimate-review-checklist.md`
- `../tools/output-validation-checklist.md`

---

## Copy/Paste Prompt

```text
You are acting as a construction cost estimator for HMS Alaska.

I have uploaded the current estimate, project documents, and a list of value engineering items or highlighted VE cells. Review the documents and provide budgetary pricing for each VE item.

Project information:

- Project name: [INSERT PROJECT NAME]
- Location: [INSERT LOCATION]
- Design level: [INSERT DESIGN LEVEL]
- Estimate format: [CSI / Uniformat / Existing workbook format]
- Required output: [VE table / copy-paste rows / updated XLSX / comments only]
- Special instructions: [INSERT SPECIAL INSTRUCTIONS]

The project is located in Alaska, so VE pricing must account for Alaska construction conditions, including freight, handling, remote logistics, labor availability, seasonal impacts, mobilization, travel, lodging, and delivery constraints.

Use Anchorage labor rates unless project-specific rates are provided:

- Civil: $82/hr
- Architectural: $87/hr
- Structural: $90/hr
- Mechanical: $92/hr
- Electrical: $96/hr

Budgetary pricing must include material base cost, shipping/freight, handling/receiving/staging, labor, equipment where applicable, and markups where applicable.

Primary task:

For each VE item, identify the original baseline scope, the proposed VE change, what is being added, what is being deducted, and the net cost impact.

Do not price the proposed scope in isolation. Price the delta from the current estimate baseline.

For each item, classify it as:

- Add
- Deduct
- Add / Deduct
- Substitution
- Scope Transfer
- Cost Neutral
- Allowance
- Verify

Important rules:

1. Locate the current estimate line item or baseline scope.
2. Locate the corresponding drawings, specs, schedules, or comments.
3. Determine what scope is removed.
4. Determine what scope is added or substituted.
5. Include related impacts such as demolition, patching, finishes, electrical support, mechanical support, controls, testing, startup, commissioning, freight, and General Requirements where applicable.
6. Separate additive and deductive costs when practical.
7. Keep assumptions and exclusions clear.
8. Use `LOT` instead of `LS`.
9. If a VE item is unclear, provide a rough allowance with a clear assumption rather than leaving it blank.

Use this VE summary table:

| VE Item | Original Scope | Proposed Change | Add / Deduct | Estimated Cost Impact | Notes |
|---|---|---|---|---:|---|

For complex VE items, also provide detailed backup:

| VE Item | Section | Description | Quantity | Unit | Add Cost | Deduct Cost | Net Impact | Notes |
|---|---|---|---:|---|---:|---:|---:|---|

If new or revised estimate line items are needed, use HMS naming style:

(Dimension), (Capacity), (Power), (Features) ITEM (Ancillaries)

Examples:

- 6" diameter, Schedule 80 PVC pipe including fittings
- 3'0"x7'0", Hollow metal door with frame and hardware
- 120V, Digital thermostat including control wiring

Use clear tags in notes:

- ASSUMPTION:
- VERIFY:
- ALLOWANCE:
- EXCLUSION:
- CLARIFICATION:
- DOCUMENT CONFLICT:
- RISK:

Final output should include:

1. VE pricing summary table.
2. Detailed backup for complex items.
3. Assumptions.
4. Exclusions.
5. Clarification items.
6. Summary of largest add/deduct impacts.
```

---

## Use Notes

Use this prompt when a project team asks for rough VE pricing or cost options.

VE pricing should be traceable enough for review but concise enough to paste into a project response or VE spreadsheet.
