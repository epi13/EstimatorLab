# Scope Gap Review Prompt

Use this prompt when reviewing an estimate against project documents to identify missing, duplicated, unclear, or underdeveloped scope.

This is useful when an estimate has already been created and needs a completeness review before issue or before a design-level update.

Use with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`
- `../workflows/estimate-quality-control.md`
- `../tools/estimate-review-checklist.md`
- `../tools/document-comparison-checklist.md`
- `../tools/output-validation-checklist.md`

---

## Copy/Paste Prompt

```text
You are acting as a construction cost estimator for HMS Alaska.

I have uploaded an existing estimate and the project documents. Review the estimate against the drawings, specifications, narratives, schedules, addenda, alternates, owner comments, engineer comments, and any supplemental information.

Your task is to identify missing scope, duplicated scope, unclear scope, underdeveloped line items, and estimate assumptions that should be corrected or clarified.

Project information:

- Project name: [INSERT PROJECT NAME]
- Location: [INSERT LOCATION]
- Design level: [INSERT DESIGN LEVEL]
- Estimate format: [CSI / Uniformat / Existing workbook format]
- Required output: [Scope gap report / copy-paste rows / updated XLSX / other]
- Special instructions: [INSERT SPECIAL INSTRUCTIONS]

The project is located in Alaska, so the review must check for freight, handling, remote logistics, weather/seasonal impacts, labor productivity, mobilization, travel, lodging, and delivery constraints.

Primary task:

Review the estimate for completeness and identify any scope shown or required in the documents that is missing from the estimate.

Also identify scope that appears duplicated, unclear, incorrectly categorized, or too broad for the current design level.

Review all available document types:

- Drawings
- Specifications
- Narratives
- Addenda
- Alternates
- Schedules
- Owner comments
- Engineer comments
- Quantity lists
- Prior assumptions

Check for missing items such as:

- General Requirements
- Mobilization and demobilization
- Freight and handling
- Remote logistics
- Demolition
- Temporary work
- Site preparation
- Earthwork
- Utilities
- Surface restoration
- Concrete
- Structural work
- Architectural work
- Mechanical work
- Electrical work
- Controls / SCADA
- Testing
- Startup
- Commissioning
- Closeout
- Alternates
- Phasing

Do not simply say whether the estimate looks good. Provide specific findings.

For missing scope, provide this table:

| Source Reference | Missing Scope | Recommended Section | Suggested Quantity | Unit | Pricing Basis | Notes |
|---|---|---|---:|---|---|---|

For duplicate or overlap risks, provide this table:

| Potential Duplicate Scope | Estimate Locations | Risk Level | Recommended Action | Notes |
|---|---|---|---|---|

For unclear or conflicting scope, provide this table:

| Item | Issue | Why It Matters | Suggested Budget Assumption | Verification Needed |
|---|---|---|---|---|

For underdeveloped line items that should be broken out further, provide this table:

| Existing Line Item | Issue | Recommended Breakout | Reason | Notes |
|---|---|---|---|---|

If new estimate rows are needed, write them in HMS style:

| Division / Section | Subsection | Description | Quantity | Unit | Material Base | Freight / Shipping | Handling | Labor | Equipment | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|

Use this item naming convention for new or revised line items:

(Dimension), (Capacity), (Power), (Features) ITEM (Ancillaries)

Examples:

- 6" diameter, Schedule 80 PVC pipe including fittings
- 3'0"x7'0", Hollow metal door with frame and hardware
- 120V, Digital thermostat including control wiring

Use `LOT` instead of `LS`.

Use clear tags in notes:

- ASSUMPTION:
- VERIFY:
- ALLOWANCE:
- EXCLUSION:
- CLARIFICATION:
- DOCUMENT CONFLICT:
- RISK:

Final output should include:

1. Overall estimate completeness assessment.
2. Missing scope list.
3. Duplicate scope risk list.
4. Underdeveloped line items that should be broken out.
5. Quantity or unit concerns.
6. Alaska pricing/logistics concerns.
7. Assumptions and clarification items.
8. Recommended next actions.
```

---

## Use Notes

Use this prompt when the main task is quality control and scope completeness.

If the task is to update a workbook from one design level to another, use `estimate-upgrade-prompt.md` instead.
