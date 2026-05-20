# HMS Style Guide

This file defines the default HMS estimating style for LLM-assisted estimate writing, estimate updates, scope reviews, and spreadsheet-ready outputs.

Use this guide when creating, editing, reviewing, or updating estimates for HMS Alaska-style deliverables.

These instructions apply unless a user-provided workbook, project-specific template, or explicit direction provides a more specific format.

---

## Purpose

The purpose of this style guide is to make LLM-generated estimating work consistent with HMS-style estimating output.

The desired result is not just a technically correct estimate. The desired result is an estimate that is easy for an estimator to review, copy, paste, edit, and issue.

HMS-style outputs should be:

- Structured
- Practical
- Spreadsheet-ready
- Clearly sectioned
- Concise but complete
- Consistent in units and terminology
- Clear about assumptions and exclusions
- Useful for budgetary construction estimating in Alaska

---

## Core HMS Style Principles

### 1. Preserve the Existing Estimate Format

When working from an existing estimate, preserve the workbook structure as much as possible.

Maintain:

- Existing tabs
- Existing page layout
- Existing section order
- Existing subsection organization
- Existing line item style
- Existing unit conventions
- Existing page titles and estimate headers where applicable

Do not redesign the estimate unless requested.

### 2. Use Clear Section and Subsection Headers

Break estimates into readable sections.

For CSI estimates, use division headers such as:

```text
DIVISION 02 – EXISTING CONDITIONS
DIVISION 03 – CONCRETE
DIVISION 04 – MASONRY
DIVISION 05 – METALS
DIVISION 06 – WOOD, PLASTICS, AND COMPOSITES
DIVISION 07 – THERMAL AND MOISTURE PROTECTION
DIVISION 08 – OPENINGS
DIVISION 09 – FINISHES
DIVISION 10 – SPECIALTIES
DIVISION 11 – EQUIPMENT
DIVISION 12 – FURNISHINGS
DIVISION 21 – FIRE SUPPRESSION
DIVISION 22 – PLUMBING
DIVISION 23 – HVAC
DIVISION 26 – ELECTRICAL
DIVISION 27 – COMMUNICATIONS
DIVISION 28 – ELECTRONIC SAFETY AND SECURITY
DIVISION 31 – EARTHWORK
DIVISION 32 – EXTERIOR IMPROVEMENTS
DIVISION 33 – UTILITIES
DIVISION 40 – PROCESS INTEGRATION
DIVISION 46 – WATER AND WASTEWATER EQUIPMENT
```

Use only the divisions required by the project.

For Uniformat estimates, use element headers appropriate to the project, such as:

```text
A – SUBSTRUCTURE
B – SHELL
C – INTERIORS
D – SERVICES
E – EQUIPMENT AND FURNISHINGS
F – SPECIAL CONSTRUCTION AND DEMOLITION
G – BUILDING SITEWORK
Z – GENERAL REQUIREMENTS / MARKUPS / CONTINGENCIES
```

### 3. Prefer Detailed Line Items Over Overly Broad Scope

Where the design level supports it, break broad scope into reasonable estimating components.

For example, do not use only:

```text
Site utilities – LOT
```

If the documents support a breakout, use:

```text
8" PVC sanitary sewer main
Sanitary sewer manholes
Trenching and bedding
Imported pipe bedding
Backfill and compaction
Surface restoration
Testing and inspection
```

At early design levels, broader allowances are acceptable, but they must be identified as allowances.

### 4. Avoid Double Counting

Before adding new lines, check whether the scope is already captured in:

- A broader existing line item
- General requirements
- A subcontractor allowance
- A system-level assembly
- A related division
- An alternate
- A contingency item

If uncertain, flag the possible overlap.

### 5. Use `LOT`, Not `LS`

HMS style uses `LOT` for lump-sum or whole-scope items.

Use:

```text
1 LOT
```

Do not use:

```text
1 LS
```

---

## Required Line Item Nomenclature

Use consistent item naming syntax.

The standard naming sequence is:

```text
(Dimension), (Capacity), (Power), (Features) ITEM (Ancillaries)
```

Write attributes in this order:

1. Dimension
2. Capacity
3. Power
4. Features
5. Item
6. Ancillaries

Omit categories that do not apply, but do not change the order of the remaining categories.

Capitalize the first word of each attribute.

Separate attributes with commas.

The item itself should be the main noun.

---

## Attribute Definitions

### Dimension

Nominal size, physical dimension, or common trade size.

Examples:

```text
4"x4"x4"
4" diameter
3'0"x7'0"
24"x24"
6" diameter
2" thick
```

### Capacity

Rated performance, volume, airflow, heat output, flow, load, or other capacity.

Examples:

```text
90 CFM
616 BTU/LF
5 GPM
500 gallon
2 ton
10 MBH
```

### Power

Electrical or mechanical power requirement.

Examples:

```text
120V
208V/3PH
480V/3PH
1/3 HP
15A
```

### Features

Material, construction type, schedule, grade, finish, configuration, or product-defining characteristics.

Examples:

```text
Schedule 80
Hollow metal
Digital
Galvanized steel
Stainless steel
Insulated
Double-wall
4-way throw
```

### ITEM

The actual item being estimated.

Examples:

```text
Diffuser
Fan
Thermostat
Valve
Door
Manhole
Pipe
Panelboard
Pump
```

### Ancillaries

Accessories, related components, included hardware, or add-ons.

Examples:

```text
With backdraft damper
With push-bar hardware
With battery backup
Including wire
Including frame and hardware
Including excavation and backfill
```

---

## Correct Line Item Examples

```text
24"x24", 90 CFM, Steel 4-way throw diffuser with opposed blade damper
3'0"x7'0", Hollow metal door with frame and lever hardware
6" diameter, Schedule 80 PVC pipe including fittings
2", Brass ball valve with unions
120V, Digital thermostat including control wiring
500 gallon, Double-wall fuel tank with venting and appurtenances
1/3 HP, 120V, Inline exhaust fan with backdraft damper
```

---

## Less Preferred Line Item Examples

Avoid vague descriptions such as:

```text
Door
Pipe
Mechanical work
Electrical work
Miscellaneous equipment
Site work
Allowance
```

If a broad item is unavoidable, describe the scope boundary clearly:

```text
ALLOWANCE: Mechanical piping and equipment not fully defined at 30% design
```

---

## Spreadsheet-Ready Description Style

Line item descriptions should be short enough to fit in a spreadsheet but complete enough to understand the scope.

Preferred style:

```text
6" diameter, HDPE sanitary sewer force main including fittings
```

Avoid overly narrative descriptions inside the line item description field:

```text
Install all pipe shown on the civil drawings, including but not limited to the pipe, fittings, appurtenances, excavation, bedding, backfill, testing, and all other things needed for a complete system.
```

Put longer scope explanations in the notes field.

---

## Standard Estimate Columns

When producing estimate rows, use the existing workbook columns if available.

If no workbook format is provided, use this default structure:

| Division / Section | Subsection | Description | Quantity | Unit | Material Unit Cost | Labor Unit Cost | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---|

When a more detailed cost breakdown is needed, use:

| Division / Section | Subsection | Description | Quantity | Unit | Material Base | Freight / Shipping | Handling | Labor | Equipment | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|

---

## Quantity Formatting

Use practical quantity formatting:

- Whole numbers for counts, fixtures, doors, equipment, and LOT items.
- One decimal place where useful for CY, TN, or calculated values.
- Avoid false precision at early design levels.
- Round budgetary quantities upward where reasonable.
- Include waste factors in the quantity or pricing note when appropriate.

Examples:

```text
12 EA
450 LF
1,250 SF
24.5 CY
1 LOT
```

---

## Unit Style

Use uppercase unit abbreviations.

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
| LOT | Lump sum / whole scope |

Do not use lowercase units in final estimate output.

Do not use `LS`.

---

## Notes Style

Notes should be concise and useful.

Use tags where appropriate:

```text
ASSUMPTION: Quantity scaled from plan.
VERIFY: Door hardware set not scheduled.
ALLOWANCE: Included due to incomplete 30% design detail.
EXCLUSION: Owner-furnished equipment not included.
CLARIFICATION: Includes excavation, bedding, backfill, and surface restoration.
DOCUMENT CONFLICT: Plan count differs from schedule.
```

Do not bury important assumptions in long paragraphs.

---

## Allowance Style

Use allowances when scope is expected but not fully defined.

Allowance line items should include:

- The word `ALLOWANCE:` in the notes or description
- The reason for the allowance
- The scope included
- The scope excluded, if important

Example:

| Section | Description | Quantity | Unit | Notes |
|---|---|---:|---|---|
| Division 26 – Electrical | Electrical demolition allowance | 1 | LOT | ALLOWANCE: Existing electrical demolition not fully defined in 35% documents. |

---

## Assumption Style

Use assumptions when the estimate requires judgment beyond what is directly shown.

Good assumption examples:

```text
ASSUMPTION: Includes 10% waste on concrete volume.
ASSUMPTION: Pricing assumes summer construction with normal access from existing road system.
ASSUMPTION: Includes freight to Anchorage plus barge shipment to project site.
```

Poor assumption examples:

```text
Assumed.
Maybe included.
Probably enough.
```

---

## Clarification Style

Use clarifications to define scope boundaries.

Examples:

```text
CLARIFICATION: Includes pipe, fittings, trenching, bedding, backfill, compaction, and testing.
CLARIFICATION: Does not include rock excavation unless specifically shown.
CLARIFICATION: Electrical rough-in included under Division 26; fixture included under Division 22.
```

---

## Exclusion Style

Use exclusions when scope is intentionally not included.

Examples:

```text
EXCLUSION: Hazardous materials abatement not included unless specifically identified in documents.
EXCLUSION: Utility company fees not included.
EXCLUSION: Owner-furnished equipment excluded from material cost; installation included where noted.
```

---

## Change Log Style

When comparing estimates or design levels, use a structured change log.

| Existing Line / Scope | New Document Condition | Action Taken | Quantity Change | Cost Impact | Notes |
|---|---|---|---:|---:|---|

Use action language such as:

- Updated quantity
- Added line item
- Deleted scope
- Moved to alternate
- Split line item
- Combined duplicate scope
- No change
- Needs verification

---

## Value Engineering Style

For VE pricing, clearly identify:

- Original scope
- Proposed VE scope
- Additive or deductive impact
- Quantity basis
- Pricing basis
- Assumptions
- Exclusions

Recommended VE table:

| VE Item | Original Scope | Proposed Change | Add / Deduct | Estimated Cost Impact | Notes |
|---|---|---|---|---:|---|

Avoid overexplaining. VE comments should be suitable for design-team review.

---

## General Requirements Style

General Requirements may be shown as a percentage at early design levels or as a detailed breakdown when requested.

When broken down, consider line items such as:

- Project management
- Superintendent
- Quality control
- Safety
- Temporary facilities
- Temporary utilities
- Mobilization / demobilization
- Site logistics
- Surveying
- Testing coordination
- Submittals and closeout
- Travel and per diem
- Equipment mobilization
- Winter protection
- Weather delay allowance

For Alaska remote work, do not forget travel, lodging, freight coordination, and material staging.

---

## Alternates Style

Alternates should be clearly separated from base bid scope.

Use labels such as:

```text
ALTERNATE 01 – ADD GENERATOR
ALTERNATE 02 – REPAIR EXISTING SYSTEM
ALTERNATE 03 – CONSTRUCT NEW CLARIFIER
```

Each alternate should include:

- Scope included
- Scope excluded
- Additive or deductive total
- Assumptions
- Relationship to base bid

Do not mix alternate scope into the base estimate unless the user directs it.

---

## Markups and Contingency Style

Separate markups from direct work where possible.

Common categories include:

- Subtotal direct work
- General requirements
- Contractor overhead and profit
- Design contingency
- Construction contingency
- Escalation
- Bonds and insurance
- Special funding contingencies such as AIS or BABAA where applicable

Always label contingencies clearly.

Do not hide contingency inside line items unless matching an existing workbook style.

---

## Copy/Paste Output Rules

When the user asks for copy/paste-ready output:

- Use tables.
- Keep one scope item per row.
- Avoid nested bullets inside table cells.
- Keep descriptions concise.
- Put assumptions in a notes column.
- Use consistent units.
- Use `LOT` instead of `LS`.
- Avoid markdown formatting inside individual cells when possible.

---

## Spreadsheet Editing Rules

When editing an XLSX workbook:

- Preserve workbook layout.
- Preserve formulas where possible.
- Preserve formatting where possible.
- Preserve tabs and tab names where possible.
- Add rows in the correct section.
- Do not overwrite unrelated sheets.
- Do not remove hidden context unless requested.
- Keep HMS naming and unit conventions.

---

## Scope Description Quality Checklist

Before finalizing line items, check that each important line has:

- Clear item noun
- Proper dimension when applicable
- Capacity when applicable
- Power when applicable
- Material or feature when applicable
- Ancillaries when needed
- Quantity
- Unit
- Material cost or allowance
- Labor cost or allowance
- Freight or handling consideration
- Concise notes if assumptions exist

---

## Final Style Standard

HMS-style estimate content should read like it was written by an estimator for another estimator.

It should be detailed enough to support review, but not so wordy that it becomes difficult to use in a spreadsheet.

Favor clear, structured, trade-aware estimate language over generic AI prose.
