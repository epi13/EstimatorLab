# Estimate Quality Control Workflow

Use this workflow when reviewing a construction estimate for completeness, accuracy, consistency, and usability before it is issued or sent back to a project team.

This workflow is intended for LLM-assisted estimate QA/QC and should be used with both new estimates and estimate updates.

Use this workflow together with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`

---

## Purpose

The purpose of this workflow is to identify problems in an estimate before it is delivered.

The review should check for:

- Missing scope
- Duplicated scope
- Incorrect quantities
- Incorrect units
- Formatting issues
- Missing assumptions
- Missing Alaska logistics
- Missing freight or handling
- Incomplete General Requirements
- Alternates mixed into base scope
- Design document conflicts
- Pricing that does not match scope

The output should be clear enough for an estimator to make corrections quickly.

---

## Required Inputs

Use all available inputs:

- Estimate workbook or PDF
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
- Project location
- Design level
- Required estimate format

If source documents are not available, perform a workbook-only QC and clearly state the limitation.

---

## QC Review Levels

Use the review level that matches the task.

| Review Level | Use When | Focus |
|---|---|---|
| Quick QC | User needs a fast review | Obvious missing scope, totals, formatting, assumptions |
| Standard QC | Normal estimate review | Scope completeness, quantities, pricing, alternates, Alaska costs |
| Deep QC | High-value or near-final estimate | Document-by-document scope trace, formulas, detailed quantity review |

If the user does not specify, perform a Standard QC.

---

## Step 1: Estimate Format Review

Check whether the estimate follows the required format.

Review:

- CSI or Uniformat organization
- Section headers
- Subsection headers
- Line item descriptions
- Quantity and unit columns
- Material and labor separation
- Freight and handling treatment
- Totals and subtotals
- Markups and contingency
- Use of `LOT` instead of `LS`
- Consistent HMS naming style

Flag issues in this table:

| Issue Type | Location | Problem | Recommended Fix |
|---|---|---|---|

---

## Step 2: Scope Completeness Review

Compare the estimate against the documents.

Check each major discipline:

- Civil / sitework
- Existing conditions / demolition
- Concrete
- Metals
- Architectural
- Thermal and moisture protection
- Openings
- Finishes
- Specialties
- Equipment
- Fire protection
- Plumbing
- HVAC
- Electrical
- Communications
- Security
- Utilities
- Process systems
- General Requirements

Flag missing scope in this table:

| Source Reference | Missing Scope | Recommended Estimate Section | Quantity | Unit | Notes |
|---|---|---|---:|---|---|

---

## Step 3: Duplicate Scope Review

Check for scope that may have been counted twice.

Common duplicate risks:

- Pipe installation includes excavation, but excavation is also priced separately.
- Equipment includes startup, but startup is also priced in commissioning.
- Vendor package includes controls, but controls are also priced in electrical.
- General Requirements include travel, but travel is also in subcontractor pricing.
- Freight is included in vendor quote and again as a separate allowance.
- Demolition is included in existing conditions and again in trade divisions.
- Surface restoration is included in civil and again in landscaping.

Use this table:

| Potential Duplicate Scope | Estimate Locations | Risk Level | Recommended Action | Notes |
|---|---|---|---|---|

Risk levels:

- High
- Medium
- Low

---

## Step 4: Quantity Review

Check whether quantities are reasonable and consistent.

Review:

- Drawing takeoffs
- Schedules
- Engineer quantities
- Estimate quantities
- Unit conversions
- Waste factors
- Rounding
- Alternates
- Area and volume calculations
- Count-based items

Flag quantity issues in this table:

| Line Item | Current Quantity | Expected / Checked Quantity | Difference | Recommendation | Notes |
|---|---:|---:|---:|---|---|

Do not overstate precision if the design level is early.

---

## Step 5: Unit Review

Check for wrong or inconsistent units.

Common issues:

- CY vs SF
- LF vs EA
- TN vs LBS
- LOT used where a measurable quantity is available
- EA used for broad undefined scope
- Lowercase units
- `LS` used instead of `LOT`

Use this table:

| Line Item | Current Unit | Recommended Unit | Reason | Notes |
|---|---|---|---|---|

---

## Step 6: Pricing Review

Check whether pricing matches the scope and project conditions.

Review:

- Material base cost
- Freight
- Handling
- Labor
- Equipment
- Subcontractor markups
- Remote logistics
- Escalation
- General Requirements
- Contingency

Flag pricing issues in this table:

| Line Item | Current Pricing Issue | Recommended Correction | Cost Impact | Notes |
|---|---|---|---:|---|

---

## Step 7: Alaska Logistics Review

For Alaska projects, confirm the estimate includes:

- Freight to project site
- Handling and staging
- Remote delivery premiums
- Travel and per diem
- Lodging or camp
- Equipment mobilization
- Weather and seasonal impacts
- Labor productivity impacts
- Material storage and weather protection
- Waste backhaul where applicable
- Barge, ferry, or air freight if applicable

Use this table:

| Alaska Cost Factor | Included? | Concern | Recommended Action |
|---|---|---|---|

---

## Step 8: General Requirements Review

Check whether General Requirements are appropriate for the project.

Review:

- Project management
- Superintendent
- Quality control
- Safety
- Temporary facilities
- Temporary utilities
- Mobilization / demobilization
- Travel
- Lodging
- Per diem
- Surveying
- Testing coordination
- Submittals and closeout
- Temporary heat
- Winter protection
- Site logistics

At later design levels, flag if General Requirements are only shown as a percentage when a dollar breakdown would be more appropriate.

---

## Step 9: Alternates and Phasing Review

Check whether alternates are clearly separated from base scope.

Review:

- Alternate titles
- Scope boundaries
- Additive or deductive amounts
- Relationship to base bid
- Duplicated base/alternate scope
- Deleted or superseded alternates
- Phasing assumptions

Use this table:

| Alternate / Phase | Issue | Recommended Action | Notes |
|---|---|---|---|

---

## Step 10: Assumptions and Exclusions Review

Check whether assumptions and exclusions are clear.

Good estimate assumptions should identify:

- What was assumed
- Why it was assumed
- Where uncertainty remains
- Whether it affects cost materially

Use clear tags:

```text
ASSUMPTION:
VERIFY:
ALLOWANCE:
EXCLUSION:
CLARIFICATION:
DOCUMENT CONFLICT:
RISK:
```

Use this table:

| Item | Current Note / Missing Note | Recommended Note | Reason |
|---|---|---|---|

---

## Step 11: Formula and Total Review

When reviewing a spreadsheet, check:

- Row extensions
- Section subtotals
- Division subtotals
- Markup formulas
- Contingency formulas
- Alternates excluded from base total unless intended
- Hidden rows or columns
- Broken formulas
- Manual overrides
- Rounding errors

Flag spreadsheet formula issues separately.

---

## Final QC Summary

Summarize issues by severity.

| Severity | Definition |
|---|---|
| Critical | Major missing scope, duplicated scope, broken total, or incorrect basis |
| High | Material cost impact or major uncertainty |
| Medium | Should be corrected before issue but not estimate-breaking |
| Low | Formatting, wording, or minor cleanup |

Use this table:

| Severity | Issue | Location | Recommended Fix | Cost Impact |
|---|---|---|---|---:|

---

## Final Deliverable

A complete estimate QC output should include:

1. Brief overall assessment.
2. Critical issues.
3. Missing scope list.
4. Duplicate scope list.
5. Quantity issues.
6. Pricing issues.
7. Alaska logistics issues.
8. General Requirements issues.
9. Alternates / phasing issues.
10. Assumption and exclusion cleanup.
11. Recommended next actions.

The goal is to help the estimator correct the estimate efficiently and confidently.
