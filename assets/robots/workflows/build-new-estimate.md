# Build New Estimate Workflow

Use this workflow when creating a new construction estimate from project documents.

This workflow is intended for LLM-assisted estimating using drawings, specifications, narratives, schedules, alternates, owner comments, engineer comments, addenda, quantity lists, and other supporting documents.

Use this workflow together with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`

---

## Purpose

The purpose of this workflow is to build a complete budgetary construction estimate from source documents while maintaining HMS-style formatting, Alaska-specific pricing assumptions, and clear documentation of assumptions and exclusions.

The output should be practical for an estimator to review, revise, and paste into an estimate workbook.

---

## Required Inputs

Use all available project information, including:

- Project name
- Project location
- Design level
- Estimate format requested: CSI, Uniformat, or existing template
- Drawings
- Specifications
- Narratives
- Addenda
- Alternates
- Schedules
- Owner comments
- Engineer comments
- Supplemental quantity lists
- Existing templates or example estimates
- Required markups, contingencies, or funding requirements

If information is missing, proceed with reasonable budgetary assumptions and flag them clearly.

---

## Initial Review Steps

1. Identify the project location.
2. Identify whether the project is road-system, coastal, ferry/barge-served, or fly-in.
3. Identify the design level.
4. Identify whether the estimate should be CSI or Uniformat.
5. Identify the primary construction type.
6. Identify alternates and phasing requirements.
7. Identify owner-furnished vs contractor-furnished scope.
8. Identify major design gaps or missing documents.

Do not begin pricing before understanding the scope organization.

---

## Estimate Structure

### CSI Estimate

Use CSI division headers where trade-based organization is appropriate.

Common divisions include:

```text
DIVISION 01 – GENERAL REQUIREMENTS
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

Only include divisions that apply.

### Uniformat Estimate

Use Uniformat or elemental categories when the project is early design or system-based.

Common categories include:

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

---

## Scope Extraction Procedure

For each drawing and specification section:

1. Identify the scope shown.
2. Identify measurable quantities.
3. Identify scheduled equipment, doors, rooms, finishes, fixtures, and systems.
4. Identify specification requirements that are not obvious in the drawings.
5. Identify drawing scope that is not described in specifications.
6. Identify alternates.
7. Identify demolition and temporary work.
8. Identify testing, startup, balancing, commissioning, and closeout requirements.
9. Identify work that requires remote logistics, special freight, or special labor.

---

## Quantity Development

Develop quantities using the best available source.

Preferred source order:

1. Engineer-provided quantity list
2. Drawing schedules and tables
3. Plan takeoff
4. Specification counts or stated requirements
5. Reasonable budgetary assumption

When quantities are assumed, state the assumption.

Use appropriate units:

| Unit | Use |
|---|---|
| EA | Individual items |
| LF | Linear items |
| SF | Area items |
| SY | Site area items |
| CY | Concrete, excavation, fill, aggregate |
| TN | Bulk materials, steel, freight |
| LBS | Reinforcing or metals |
| HR | Labor or equipment hours |
| DAY | Rentals, monitoring, travel |
| WEEK | Extended duration services |
| MO | Long duration rentals |
| LOT | Lump sum / whole-scope item |

Use `LOT`, not `LS`.

---

## Line Item Writing Rules

Use HMS naming style.

Standard item syntax:

```text
(Dimension), (Capacity), (Power), (Features) ITEM (Ancillaries)
```

Examples:

```text
6" diameter, Schedule 80 PVC pipe including fittings
3'0"x7'0", Hollow metal door with frame and hardware
120V, Digital thermostat including control wiring
24"x24", 90 CFM, Steel 4-way throw diffuser with opposed blade damper
```

Keep descriptions concise but specific.

---

## Pricing Procedure

For each line item, include:

1. Material base cost
2. Shipping / freight
3. Handling / receiving / staging
4. Labor
5. Equipment where applicable
6. Subcontractor markup where applicable

Use Anchorage labor rates unless project-specific rates are provided:

| Trade | Rate |
|---|---:|
| Civil | $82/hr |
| Architectural | $87/hr |
| Structural | $90/hr |
| Mechanical | $92/hr |
| Electrical | $96/hr |

Adjust labor productivity for Alaska conditions, remote logistics, limited staging, and seasonal impacts.

---

## General Requirements

Include General Requirements appropriate to the project.

Consider:

- Project management
- Superintendent
- Quality control
- Safety
- Submittals and closeout
- Mobilization / demobilization
- Temporary facilities
- Temporary utilities
- Temporary heat
- Surveying
- Testing coordination
- Travel and per diem
- Lodging or camp
- Freight coordination
- Material staging
- Equipment mobilization
- Winter protection

For remote projects, General Requirements may be a major cost component and should not be treated as a minor percentage without review.

---

## Alternates

Separate alternates from base scope.

Each alternate should include:

- Alternate title
- Scope included
- Scope excluded
- Additive or deductive price
- Assumptions
- Relationship to base bid

Do not blend alternate costs into the base estimate unless directed.

---

## Assumptions and Exclusions

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

Every assumed quantity, unclear scope boundary, or budget allowance should be traceable.

---

## Default Output Table

Use this structure unless the user provides a workbook format:

| Division / Section | Subsection | Description | Quantity | Unit | Material Unit Cost | Labor Unit Cost | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---|

For Alaska pricing transparency, use this expanded version when useful:

| Division / Section | Subsection | Description | Quantity | Unit | Material Base | Freight / Shipping | Handling | Labor | Equipment | Total | Notes |
|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---|

---

## Quality Control Before Finalizing

Before finalizing a new estimate, check for:

- Missing major divisions
- Missing General Requirements
- Missing freight
- Missing remote logistics
- Missing alternates
- Missing demolition
- Missing temporary work
- Missing electrical support for mechanical equipment
- Missing controls, testing, startup, balancing, or commissioning
- Missing site restoration
- Duplicated scope
- Unclear owner-furnished vs contractor-furnished scope
- Wrong unit usage
- Inconsistent use of `LOT`
- Unexplained assumptions

---

## Final Deliverable

A complete new-estimate output should include:

1. Estimate line items
2. General Requirements
3. Alternates if applicable
4. Markups and contingencies if requested
5. Assumptions
6. Exclusions
7. Clarifications
8. Missing information / verification list
9. Brief summary of major cost drivers

The output should be ready for estimator review and spreadsheet entry.
