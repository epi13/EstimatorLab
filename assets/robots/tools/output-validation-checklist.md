# Output Validation Checklist

Use this checklist before returning any LLM-generated estimating output, spreadsheet-ready rows, workbook edits, estimate reviews, quantity reconciliations, VE summaries, or document comparison results.

This is the final quality gate for LLM-assisted estimating work in EstimatorLab.

Use this checklist together with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`
- `../workflows/spreadsheet-output-rules.md`

---

## Purpose

The purpose of this checklist is to make sure the final output is usable, traceable, and consistent with HMS estimating standards before it is returned to the user or committed into a workbook.

The checklist should catch:

- Missing required sections
- Poor spreadsheet formatting
- Inconsistent units
- `LS` used instead of `LOT`
- Missing assumptions
- Missing Alaska pricing components
- Hidden uncertainty
- Duplicated scope
- Broken or unclear change logic
- Output that is too narrative to use

---

## Core Validation Rule

Before finalizing, ask:

```text
Can an estimator use this output directly without having to decode hidden assumptions, rewrite every line, or guess what was included?
```

If the answer is no, revise the output.

---

## Task Type Validation

First confirm the output matches the requested task.

| Task Type | Required Output |
|---|---|
| New estimate | Estimate rows, assumptions, exclusions, General Requirements, alternates if applicable |
| Estimate update | Updated rows, change log, added/deleted/revised scope notes |
| Document comparison | Classification, added/deleted/revised scope, conflicts, recommendations |
| Quantity reconciliation | Reconciliation table, action for each quantity, duplicate-risk notes |
| VE review | VE summary, add/deduct pricing, assumptions, exclusions |
| Estimate QC | Issue list by severity, missing scope, duplicate risks, recommendations |
| Workbook edit | Updated file or clearly described workbook edits |

If the output does not match the task, revise before returning.

---

## File and Folder Validation

When writing repo files, confirm:

- File path is correct.
- File name matches the requested name.
- Markdown headings are clear.
- Links to related files use correct relative paths.
- Content fits the purpose of the folder.
- No unrelated instructions were added.
- Existing files were updated rather than duplicated.

When creating or editing estimate workbooks, confirm:

- Correct file type is produced.
- Existing workbook format is preserved where required.
- Sheet names are preserved where required.
- Formulas are preserved where possible.
- New rows are added in correct locations.
- Output file is linked for download if created outside Git.

---

## Spreadsheet Readiness Validation

For spreadsheet-ready output, confirm:

- One scope item per row.
- Columns are clearly labeled.
- Quantities are in quantity columns.
- Units are in unit columns.
- Cost values are in cost columns.
- Notes are in notes columns.
- Descriptions are concise.
- Assumptions are not hidden in descriptions.
- Numeric fields do not contain long text.
- Tables can be copied into a spreadsheet.

Use this final check:

| Check | Pass / Fail | Notes |
|---|---|---|
| One scope item per row |  |  |
| Quantity and unit separate |  |  |
| Cost columns numeric |  |  |
| Notes concise |  |  |
| Output easy to paste |  |  |

---

## HMS Style Validation

Confirm the output follows HMS style:

- `LOT` is used instead of `LS`.
- Section headers are clear.
- Subsection headers are clear.
- Line items are specific.
- Broad allowances are labeled.
- Notes use clear tags.
- Alternates are separated.
- Assumptions and exclusions are included.
- Output is estimator-facing, not generic prose.

---

## Item Naming Validation

Check line item naming against the HMS sequence:

```text
(Dimension), (Capacity), (Power), (Features) ITEM (Ancillaries)
```

Confirm:

- Dimension is included where applicable.
- Capacity is included where applicable.
- Power is included where applicable.
- Features are included where applicable.
- Item noun is clear.
- Ancillaries are included where applicable.
- Attributes remain in the correct order.

Examples of acceptable descriptions:

```text
6" diameter, Schedule 80 PVC pipe including fittings
3'0"x7'0", Hollow metal door with frame and hardware
120V, Digital thermostat including control wiring
24"x24", 90 CFM, Steel 4-way throw diffuser with opposed blade damper
```

---

## Unit Validation

Confirm units are consistent and appropriate.

Preferred units:

| Unit | Meaning |
|---|---|
| EA | Each |
| LF | Linear feet |
| SF | Square feet |
| SY | Square yards |
| CY | Cubic yards |
| TN | Tons |
| LBS | Pounds |
| HR | Hours |
| DAY | Days |
| WEEK | Weeks |
| MO | Months |
| LOT | Lump sum / whole-scope item |

Fail the output if `LS` appears where HMS style requires `LOT`.

---

## Alaska Pricing Validation

For Alaska estimates, confirm that pricing considers:

- Material base cost
- Shipping / freight
- Handling / receiving / staging
- Labor
- Equipment where applicable
- Remote logistics where applicable
- Seasonal or weather impacts where applicable
- Mobilization / demobilization
- Travel, lodging, and per diem where applicable
- Escalation where applicable

If exact pricing is unavailable, confirm reasonable assumptions are stated.

Example acceptable note:

```text
ASSUMPTION: Unit pricing includes material base cost, 18% freight and handling allowance, and Anchorage labor with 20% productivity increase for remote logistics.
```

---

## Labor Validation

Confirm labor is calculated or assumed using the correct trade rate unless project-specific rates are provided.

Default Anchorage rates:

| Trade | Rate |
|---|---:|
| Civil | $82/hr |
| Architectural | $87/hr |
| Structural | $90/hr |
| Mechanical | $92/hr |
| Electrical | $96/hr |

Confirm:

- Labor trade category is appropriate.
- Man-hours are reasonable.
- Remote productivity impacts are considered.
- Work conditions are reflected.
- Labor assumptions are documented when important.

---

## Scope Validation

Before returning output, check:

- Major scope areas are represented.
- Missing scope is identified.
- Deleted scope is not silently removed.
- Added scope is clearly identified.
- Revised scope is clearly identified.
- Alternates are separated from base scope.
- Owner-furnished and contractor-furnished scope are not confused.
- Temporary work is included or excluded clearly.
- Testing, startup, and commissioning are included where required.

---

## Duplicate Scope Validation

Check whether any cost may be counted twice.

Common duplicate risks:

- Excavation included in pipe unit price and again under earthwork.
- Bedding included in utility line and again as aggregate.
- Freight included in material unit cost and again in freight allowance.
- Vendor startup included in equipment and again in commissioning.
- Controls included in mechanical equipment and again in electrical/SCADA.
- Travel included in subcontractor quote and again in General Requirements.
- Surface restoration included in utilities and again in sitework.

If duplication risk exists, flag it before returning output.

---

## Assumption Validation

Confirm assumptions are:

- Explicit
- Specific
- Tagged
- Relevant
- Not misleading
- Appropriate for the design level

Use tags:

```text
ASSUMPTION:
VERIFY:
ALLOWANCE:
EXCLUSION:
CLARIFICATION:
DOCUMENT CONFLICT:
RISK:
```

Do not return output with vague notes such as:

```text
Assumed.
Maybe included.
TBD.
```

Replace them with specific notes.

---

## Change Log Validation

For estimate updates or comparisons, confirm the change log includes:

- Existing line or scope
- New document condition
- Action taken
- Quantity impact
- Cost impact if available
- Notes

Action terms should be clear:

- Added line
- Updated quantity
- Updated pricing
- Deleted scope
- Split line
- Combined lines
- Moved to alternate
- No change
- Needs verification

---

## Quantity Reconciliation Validation

For engineer quantity reconciliation, confirm:

- Every provided quantity is addressed.
- Each quantity has a category.
- Each quantity has an action.
- Existing estimate matches are shown.
- Duplicate risks are flagged.
- Conflicts are flagged.
- New lines are added only for missing scope.

Required categories:

- Already Included
- Update Existing
- Split Existing
- Add New
- Alternate
- Duplicate Risk
- Conflict
- Exclude

---

## VE Output Validation

For VE reviews, confirm:

- Original scope is identified.
- Proposed change is identified.
- Additive and deductive components are separated.
- Net cost impact is shown.
- Related scope impacts are considered.
- Assumptions are clear.
- Exclusions are clear.
- Alaska freight and labor impacts are included where applicable.

---

## Document Comparison Validation

For document comparisons, confirm:

- Overall comparison classification is provided.
- Added scope is listed.
- Deleted scope is listed.
- Revised scope is listed.
- Quantity changes are listed.
- Drawing/spec conflicts are flagged.
- Alternates and phasing are reviewed.
- Alaska logistics impacts are considered.
- Recommendation is clear.

---

## Workbook Validation

When an XLSX or spreadsheet file is created or edited, confirm:

- Workbook opens successfully.
- Sheets are named correctly.
- Existing layout is preserved if required.
- Formulas are preserved where possible.
- New rows are included in subtotal formulas.
- Cost columns are numeric.
- Quantity columns are numeric.
- Notes are text.
- Currency formatting is applied where appropriate.
- Alternates are separate from base estimate.
- Final total appears reasonable.

---

## Final Response Validation

Before responding to the user, confirm:

- The response says what was completed.
- Any limitations are stated honestly.
- Links to created files are included if files were produced.
- Citations are included if connected-source or file-search results were used.
- The answer does not claim unsupported certainty.
- The answer does not include unnecessary internal process detail.
- The answer is concise enough for the user to act on.

---

## Final Gate Checklist

Use this final gate before completing the task:

| Validation Item | Pass / Fail | Notes |
|---|---|---|
| Task request satisfied |  |  |
| Correct file or output format |  |  |
| HMS style followed |  |  |
| `LOT` used instead of `LS` |  |  |
| Alaska pricing considered |  |  |
| Assumptions clear |  |  |
| Exclusions clear |  |  |
| Duplicate scope checked |  |  |
| Quantities and units consistent |  |  |
| Output is copy/paste-ready |  |  |
| Limitations stated |  |  |

---

## Final Standard

The final output should be something an estimator can immediately use, review, or paste into a workbook.

If the output is technically correct but not usable, revise it.

If the output depends on assumptions, state them.

If the output may duplicate scope, flag it.

If the output is incomplete, say exactly what remains incomplete.
