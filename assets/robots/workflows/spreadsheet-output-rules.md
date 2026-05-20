# Spreadsheet Output Rules

Use this workflow when producing estimate content that will be copied into a spreadsheet or written directly into an XLSX workbook.

This file defines output rules for LLM-assisted estimate rows, change logs, quantity reconciliations, VE summaries, and workbook edits.

Use this workflow together with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`

---

## Purpose

The purpose of this file is to make LLM-generated estimate output easy to paste, review, and convert into spreadsheet format.

Spreadsheet output should be:

- Structured
- Consistent
- One scope item per row
- Clear about quantity and unit
- Clear about cost components
- Clear about assumptions
- Free of unnecessary prose inside cells
- Compatible with HMS-style estimate workbooks

---

## Core Rule

Write for the spreadsheet first.

Do not produce long paragraphs when table rows are more useful.

Do not bury quantities, units, or assumptions inside narrative text.

---

## Preserve Existing Workbook Format

When editing or updating an existing workbook, preserve:

- Sheet names
- Sheet order
- Column order
- Existing section titles
- Existing subsection titles
- Existing line item order where reasonable
- Existing formulas
- Existing cell styles
- Existing page layout
- Existing print settings where practical

Do not create a new format unless the user requests it.

---

## Default Estimate Row Format

If no workbook format is provided, use this table:

| Division / Section | Subsection | Description | Quantity | Unit | Material Unit Cost | Labor Unit Cost | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---|

For Alaska-specific pricing transparency, use this expanded table when useful:

| Division / Section | Subsection | Description | Quantity | Unit | Material Base | Freight / Shipping | Handling | Labor | Equipment | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|

---

## Column Rules

### Division / Section

Use clear division or element headings.

Examples:

```text
DIVISION 03 – CONCRETE
DIVISION 26 – ELECTRICAL
G – BUILDING SITEWORK
```

### Subsection

Use a concise trade or scope grouping.

Examples:

```text
Foundations
Interior Finishes
Sanitary Sewer
Controls
General Requirements
```

### Description

Use HMS item naming style.

Standard sequence:

```text
(Dimension), (Capacity), (Power), (Features) ITEM (Ancillaries)
```

Examples:

```text
6" diameter, Schedule 80 PVC pipe including fittings
3'0"x7'0", Hollow metal door with frame and hardware
120V, Digital thermostat including control wiring
```

### Quantity

Use numeric values only where possible.

Good:

```text
125
1
24.5
```

Avoid:

```text
About 125 LF
One lot
TBD
```

If the quantity is unknown, use `1` with unit `LOT` and explain the allowance in notes.

### Unit

Use uppercase standard units.

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

Use `LOT`, not `LS`.

### Cost Columns

Use numeric values without explanatory text.

Good:

```text
125.00
4500.00
```

Avoid:

```text
$125 assumed
Approx. 4500
Included above
```

Put explanatory text in the Notes column.

### Notes

Use concise notes with tags:

```text
ASSUMPTION: Quantity scaled from 65% plans.
VERIFY: Final equipment selection not provided.
ALLOWANCE: Included due to incomplete design detail.
EXCLUSION: Winter conditions excluded.
CLARIFICATION: Includes excavation, bedding, backfill, and testing.
```

---

## One Scope Item Per Row

Each row should represent one estimate scope item.

Avoid combining unrelated work into one row.

Poor:

```text
Doors, windows, finishes, and specialties
```

Better:

```text
3'0"x7'0", Hollow metal door with frame and hardware
Aluminum storefront window system
Painted gypsum wallboard finish
Toilet accessories
```

At early design levels, allowances may combine scope, but the notes should explain what is included.

---

## Section Header Rows

When producing rows intended for spreadsheet import, identify header rows clearly.

Example:

| Row Type | Division / Section | Subsection | Description | Quantity | Unit | Notes |
|---|---|---|---|---:|---|---|
| HEADER | DIVISION 03 – CONCRETE |  |  |  |  |  |
| SUBHEADER | DIVISION 03 – CONCRETE | Foundations |  |  |  |  |
| LINE | DIVISION 03 – CONCRETE | Foundations | 4,500 PSI, Reinforced concrete ringwall | 25 | CY | ASSUMPTION: Includes waste. |

If the workbook already has header formatting, do not add a Row Type column unless needed for clarity.

---

## Change Log Output

For estimate updates, use this structure:

| Existing Line / Scope | New Document Condition | Action Taken | Revised Quantity | Cost Impact | Notes |
|---|---|---|---:|---:|---|

Recommended action terms:

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

## Quantity Reconciliation Output

For engineer quantity reconciliation, use this structure:

| Engineer Quantity Item | Engineer Qty | Unit | Existing Estimate Match | Category | Action Taken | Revised Estimate Line | Notes |
|---|---:|---|---|---|---|---|---|

Category terms:

- Already Included
- Update Existing
- Split Existing
- Add New
- Alternate
- Duplicate Risk
- Conflict
- Exclude

---

## VE Output

For value engineering summaries, use this structure:

| VE Item | Original Scope | Proposed Change | Add / Deduct | Estimated Cost Impact | Notes |
|---|---|---|---|---:|---|

For detailed VE backup, use:

| VE Item | Section | Description | Quantity | Unit | Add Cost | Deduct Cost | Net Impact | Notes |
|---|---|---|---:|---|---:|---:|---:|---|

---

## Clarification Output

For questions or unresolved items, use:

| Item | Clarification Needed | Why It Matters | Suggested Budget Assumption |
|---|---|---|---|

---

## Missing Scope Output

For missing scope reviews, use:

| Source Reference | Missing Scope | Recommended Section | Quantity | Unit | Pricing Basis | Notes |
|---|---|---|---:|---|---|---|

---

## Numeric Formatting

Use consistent numeric formatting:

- Quantities: no dollar signs
- Costs: numeric values; dollar signs are optional in narrative but not preferred in raw spreadsheet rows
- Whole numbers for EA, LF, SF where reasonable
- One decimal place for CY or TN where useful
- Avoid false precision
- Use commas only if the receiving spreadsheet handles them correctly

Examples:

```text
125
1,250
24.5
4500.00
```

---

## Formula Awareness

When editing a workbook:

- Preserve formulas.
- Do not overwrite subtotal formulas with static values unless directed.
- Do not break linked totals.
- Check whether inserted rows are included in subtotal ranges.
- Verify markups and contingencies still reference the correct subtotal.
- Verify alternates are not included in base total unless intended.

If formulas cannot be verified, flag it.

---

## Notes for Workbook Updates

When adding or revising spreadsheet lines, use concise notes:

```text
ADDED: New scope shown on 65% drawings.
UPDATED: Quantity revised per engineer quantity list.
SPLIT: Former allowance broken into pipe, manhole, and trenching lines.
VERIFY: Scope may overlap with existing General Requirements allowance.
```

---

## Avoid These Spreadsheet Problems

Avoid:

- Long paragraphs in line item descriptions
- Multiple unrelated scope items in one row
- Vague descriptions like `miscellaneous work`
- Missing units
- Mixed unit styles
- `LS` instead of `LOT`
- Text inside numeric cost columns
- Unexplained zero-cost rows
- Alternates mixed into base scope
- Hidden assumptions
- Duplicated scope
- Broken formulas

---

## Workbook Creation Rules

When creating a new XLSX estimate:

- Use clear sheet names.
- Freeze panes where helpful.
- Use bold section headers.
- Use consistent column widths.
- Use currency formatting for cost columns.
- Use numeric formatting for quantity columns.
- Use text wrapping for notes.
- Preserve HMS-style structure.
- Include assumptions and exclusions.
- Include alternates separately.

---

## Workbook Editing Rules

When editing an existing XLSX estimate:

- Do not change unrelated sheets.
- Do not remove existing formulas without reason.
- Do not alter workbook style unnecessarily.
- Add rows near related scope.
- Keep line item wording consistent with nearby rows.
- Preserve print layout where possible.
- Save an updated copy rather than overwriting the only source file when working outside Git.

---

## Final Output Checklist

Before returning spreadsheet-ready content, check:

- One scope item per row
- Correct units
- `LOT` used instead of `LS`
- Numeric columns contain numbers
- Notes contain assumptions instead of hidden text in cost cells
- Section organization is clear
- Alaska freight / handling / labor assumptions are included
- Added / revised / deleted scope is traceable
- Alternates are separate
- Output is easy to paste into a workbook

---

## Final Standard

Spreadsheet output should reduce estimator cleanup time.

The best output is not the most verbose output. The best output is structured, accurate, traceable, and easy to paste or import into the estimate workbook.
