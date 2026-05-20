# Reconcile Engineer Quantities Workflow

Use this workflow when an engineer, architect, owner, or design team provides a quantity list after an estimate has already been created.

The primary goal is to incorporate the provided quantities without double counting scope that is already included in the estimate.

Use this workflow together with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`

---

## Purpose

Engineer-provided quantities can improve an estimate, but they can also create duplication if added blindly.

This workflow ensures that each provided quantity is reviewed against:

- Existing estimate line items
- Drawings
- Specifications
- Narratives
- Alternates
- Allowances
- General Requirements

The result should show whether each quantity updates an existing line, adds missing scope, or should be flagged for clarification.

---

## Required Inputs

Use all available inputs:

- Current estimate workbook or PDF
- Engineer quantity list
- Drawings
- Specifications
- Narratives
- Alternates
- Addenda
- Owner or engineer comments
- Prior assumptions and exclusions
- Project location and design level

If the project documents are not available, reconcile quantities against the estimate only and flag the limitation.

---

## Core Rule

Do not add an engineer quantity as a new line until you determine whether the scope is already included.

For every quantity, ask:

1. Is this exact scope already in the estimate?
2. Is this scope partially included in a broader line?
3. Is this quantity a breakout of an existing line?
4. Is this truly missing scope?
5. Is this alternate scope?
6. Is this owner-furnished or contractor-furnished?
7. Does this quantity conflict with drawings or specs?

---

## Reconciliation Categories

Classify each engineer quantity using one of these categories:

| Category | Meaning | Action |
|---|---|---|
| Already Included | Scope is already captured in the estimate | Do not add; update if needed |
| Update Existing | Scope exists but quantity or pricing should change | Revise existing line |
| Split Existing | Quantity is a breakout of a broad line | Split line or note breakout |
| Add New | Scope is missing | Add new HMS-style line |
| Alternate | Scope belongs in an alternate | Add or update alternate section |
| Duplicate Risk | Quantity may overlap with existing scope | Flag before pricing |
| Conflict | Quantity conflicts with documents | Use best judgment and flag verification |
| Exclude | Quantity is not contractor scope | Do not include; document exclusion |

---

## Step-by-Step Process

### Step 1: Normalize the Quantity List

Convert the engineer quantity list into a working table with:

- Quantity item name
- Quantity
- Unit
- Source reference
- Notes
- Potential division or section

Standardize units where needed.

### Step 2: Map Existing Estimate Lines

Identify existing estimate lines that may relate to each quantity.

Search broadly. A quantity may be included under a different name or broader system line.

Examples:

- Pipe may be included in a utility allowance.
- Electrical feeders may be included in equipment wiring.
- Excavation may be included with pipe installation.
- Controls may be included in a vendor package.
- Surface restoration may be included in sitework.

### Step 3: Compare Against Documents

Review drawings and specifications to understand what the quantity represents.

Check whether the provided quantity is:

- Base scope
- Alternate scope
- Existing condition
- Demolition
- New work
- Temporary work
- Testing or commissioning
- Contractor-furnished
- Owner-furnished

### Step 4: Decide the Action

For each item, decide whether to:

- Update an existing line
- Add a new line
- Split an existing line
- Move scope to alternate
- Mark as duplicate risk
- Exclude from estimate
- Request verification

### Step 5: Update the Estimate

When updating the estimate:

- Preserve workbook layout.
- Update existing lines first.
- Add new lines only where needed.
- Place new lines in the correct section.
- Use HMS naming conventions.
- Use `LOT`, not `LS`.
- Update totals and formulas where applicable.
- Add notes explaining the change.

---

## Quantity Reconciliation Table

Use this table to document the reconciliation:

| Engineer Quantity Item | Engineer Qty | Unit | Existing Estimate Match | Category | Action Taken | Revised Estimate Line | Notes |
|---|---:|---|---|---|---|---|---|

---

## New Line Item Table

Use this table for quantities that require new estimate lines:

| Division / Section | Subsection | Description | Quantity | Unit | Material Unit Cost | Labor Unit Cost | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---|

Expanded Alaska version:

| Division / Section | Subsection | Description | Quantity | Unit | Material Base | Freight / Shipping | Handling | Labor | Equipment | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|

---

## Description Rules for Added Lines

Use the HMS item naming sequence:

```text
(Dimension), (Capacity), (Power), (Features) ITEM (Ancillaries)
```

Examples:

```text
8" diameter, PVC sanitary sewer pipe including fittings
4' diameter, Precast concrete manhole with frame and cover
120V, Electric unit heater including thermostat and wiring
```

---

## Notes for Existing Line Updates

When updating an existing line, add a concise note.

Examples:

```text
UPDATED: Quantity revised to match engineer-provided quantity list.
UPDATED: Existing line increased from 280 LF to 415 LF.
SPLIT: Existing site utility allowance broken into pipe, manhole, and trenching lines.
VERIFY: Engineer quantity appears to include pipe bedding already included under earthwork.
```

---

## Avoiding Duplication

Common duplication risks include:

- Pipe and trenching both priced with excavation included
- Fixtures included in plumbing and again in equipment
- Controls included in mechanical package and again in electrical
- Vendor startup included in equipment and again in commissioning
- Surface restoration included in civil and again in landscaping
- General Requirements included in subcontractor quotes and again in project GR
- Freight included in vendor quote and again as a separate freight allowance

Flag these before adding cost.

---

## Pricing Updates

When a quantity changes, determine whether pricing also needs revision.

Pricing may need revision if:

- Quantity changed significantly
- Scope was split into more detailed line items
- Freight assumptions changed
- Labor productivity changed
- Material type changed
- Unit cost no longer fits the revised quantity scale
- Design level changed

Use Anchorage labor rates unless project-specific labor rates are provided.

Include material base cost, freight, handling, and labor.

---

## Conflict Handling

If the engineer quantity conflicts with drawings or specifications:

1. Note the conflict.
2. Use the engineer quantity if the user has directed that those quantities are to be incorporated.
3. Flag the item for verification.
4. Do not hide the conflict.

Example:

```text
DOCUMENT CONFLICT: Engineer quantity lists 515 LF; plan takeoff appears closer to 470 LF. Estimate updated to engineer quantity per direction; verify with civil engineer.
```

---

## Final Quality Control

Before finalizing the reconciliation, check:

- Every engineer quantity has a category.
- Every engineer quantity has an action.
- Existing matching lines were updated before new lines were added.
- Duplicate scope was flagged.
- Alternates remain separate.
- New lines are in correct sections.
- Units are consistent.
- Notes explain major changes.
- Totals and formulas are updated.
- Freight and labor assumptions remain appropriate.

---

## Final Deliverable

The final output should include:

1. Reconciliation table for every engineer quantity.
2. Updated estimate rows or workbook edits.
3. New line item table for missing scope.
4. Duplicate-risk list.
5. Clarification list.
6. Summary of cost impact.

The goal is to make quantity incorporation transparent and prevent doubling up the estimate.
