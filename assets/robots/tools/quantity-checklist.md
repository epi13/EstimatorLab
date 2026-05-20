# Quantity Checklist

Use this checklist when developing, reviewing, reconciling, or validating construction estimate quantities.

This tool is intended for LLM-assisted estimating work in EstimatorLab. It should be used with project drawings, specifications, schedules, narratives, prior estimates, and engineer-provided quantity lists.

Use this checklist together with:

- `../global-estimating-instructions.md`
- `../hms-style-guide.md`
- `../alaska-pricing-guidelines.md`
- `../workflows/build-new-estimate.md`
- `../workflows/reconcile-engineer-quantities.md`

---

## Purpose

The purpose of this checklist is to help prevent quantity errors, missed scope, duplicated scope, and incorrect units in construction estimates.

A quantity is not reliable just because it appears in a drawing, schedule, spreadsheet, or prior estimate. Quantities must be checked against the available documents and the estimate scope boundary.

---

## Quantity Source Priority

Use the best available source for each quantity.

Preferred source order:

1. Engineer-provided quantity list, if the user has directed that it be used.
2. Drawing schedules and tables.
3. Plan and detail takeoff.
4. Specification requirements.
5. Prior estimate quantities, if still valid.
6. Reasonable budgetary assumption.

If sources conflict, state which source was used and why.

Example:

```text
DOCUMENT CONFLICT: Engineer quantity lists 515 LF; plan takeoff appears closer to 470 LF. Estimate uses engineer quantity per direction. Verify with civil engineer.
```

---

## General Quantity Checks

For each quantity, confirm:

- Scope item is clearly identified.
- Quantity source is known.
- Unit is appropriate.
- Quantity matches the estimate description.
- Quantity does not duplicate another line item.
- Quantity includes or excludes waste consistently.
- Quantity basis is appropriate for the design level.
- Quantity belongs in base bid, alternate, or allowance.
- Quantity includes related components only when intended.
- Notes explain assumptions or conflicts.

---

## Unit Selection Checklist

Use practical estimating units.

| Unit | Use |
|---|---|
| EA | Countable individual items |
| LF | Linear items such as pipe, conduit, fence, curb, joint sealant |
| SF | Area items such as walls, flooring, insulation, roofing, waterproofing |
| SY | Pavement, geotextile, large site areas where appropriate |
| CY | Concrete, excavation, fill, aggregate, spoils |
| TN | Bulk materials, structural steel, waste, freight |
| LBS | Reinforcing steel, miscellaneous metals |
| HR | Labor or equipment hours |
| DAY | Rentals, monitoring, temporary services |
| WEEK | Extended duration monitoring or rental items |
| MO | Long-duration temporary facilities or rentals |
| LOT | Lump sum / whole-scope items |

Use `LOT`, not `LS`.

---

## Rounding Guidance

Use reasonable rounding based on design level.

| Design Level | Quantity Approach |
|---|---|
| Concept / ROM | Rounded allowances acceptable |
| 30% | Round to practical budgetary units; avoid false precision |
| 35% / PER | Use planning quantities with clear assumptions |
| 65% / 70% | Use detailed takeoff where drawings support it |
| 95% | Use coordinated quantities from drawings, schedules, and specs |
| Final / Bid-Level | Minimize assumptions; verify takeoff closely |

Avoid presenting early design quantities as if they are final bid takeoffs.

---

## Waste Factor Checklist

Confirm whether waste is included for:

- Concrete
- Rebar
- Lumber
- Sheathing
- Drywall
- Flooring
- Roofing
- Insulation
- Pipe
- Conduit
- Wire
- Aggregate
- Coatings
- Paint
- Tile
- Ceiling systems

If waste is included, note it when material cost or quantity could otherwise look high.

Example:

```text
ASSUMPTION: Quantity includes 10% waste.
```

---

## Civil / Sitework Quantity Checks

Check quantities for:

- Clearing and grubbing area
- Topsoil stripping
- Excavation volume
- Rock excavation allowance
- Dewatering allowance
- Trench length
- Trench depth
- Trench width
- Bedding quantity
- Pipe zone material
- Backfill quantity
- Imported fill
- Export / disposal
- Surface restoration
- Gravel surfacing
- Asphalt paving
- Concrete flatwork
- Erosion control
- Seeding or revegetation
- Fencing
- Signs and striping

Key questions:

- Are excavation and backfill included with pipe installation or separate?
- Is imported material required or is native material reused?
- Is unsuitable material included?
- Is disposal or backhaul required?
- Is surface restoration included?
- Is winter earthwork included or excluded?

---

## Concrete Quantity Checks

Check quantities for:

- Footings
- Slabs
- Walls
- Piers
- Ringwalls
- Equipment pads
- Thrust blocks
- Curbs
- Formwork
- Reinforcing
- Anchor bolts
- Embedded plates
- Vapor barrier
- Rigid insulation
- Dampproofing / waterproofing
- Concrete testing
- Cold-weather protection

Key questions:

- Is volume in CY calculated from dimensions?
- Is waste included?
- Are forms measured as contact area?
- Is reinforcing estimated separately or included?
- Are embeds and anchor bolts included?
- Is concrete pumping required?

---

## Architectural Quantity Checks

Check quantities for:

- Doors, frames, and hardware
- Windows and glazing
- Framing
- Sheathing
- Insulation
- Vapor barrier
- Weather barrier
- Roofing
- Siding
- Interior partitions
- Gypsum board
- Painting
- Flooring
- Ceilings
- Wall protection
- Toilet accessories
- Casework
- Specialties

Key questions:

- Do room finish schedules match plan areas?
- Do door counts match door schedules?
- Are frames and hardware included?
- Are finish transitions and patching included?
- Are demolition and new finishes both accounted for?

---

## Mechanical Quantity Checks

Check quantities for:

- Plumbing fixtures
- Domestic water piping
- Sanitary waste and vent piping
- Hydronic piping
- Ductwork
- Diffusers and grilles
- Fans
- Pumps
- Boilers
- Unit heaters
- Insulation
- Valves
- Heat trace
- Controls
- Testing and balancing
- Startup and commissioning

Key questions:

- Are pipe fittings included?
- Are valves and accessories included?
- Are supports and hangers included?
- Are controls included with mechanical or electrical?
- Is electrical support included separately?
- Is freeze protection required?

---

## Electrical Quantity Checks

Check quantities for:

- Service equipment
- Panelboards
- Transformers
- Feeders
- Branch wiring
- Conduit
- Lighting fixtures
- Lighting controls
- Devices
- Disconnects
- Fire alarm
- Communications
- Security
- Generator systems
- Heat trace power
- Mechanical equipment connections
- Controls wiring
- Testing and commissioning

Key questions:

- Are feeders included for all equipment?
- Are disconnects included?
- Are controls and low-voltage systems included?
- Are long-lead gear allowances included?
- Are trenching and duct banks included if underground?

---

## Water / Wastewater / Utility Quantity Checks

Check quantities for:

- Pipe by size and material
- Manholes
- Cleanouts
- Valves
- Hydrants
- Fittings
- Thrust restraint
- Service connections
- Force mains
- Lift stations
- Tanks
- Process equipment
- Coatings
- Controls / SCADA
- Bypass pumping
- Testing and disinfection
- Startup and operator training

Key questions:

- Are fittings included or separate?
- Are appurtenances included?
- Is bypass pumping required?
- Are controls and instrumentation included?
- Is vendor startup included?
- Is surface restoration included?

---

## Alaska-Specific Quantity Checks

For Alaska projects, confirm whether quantities account for:

- Freight weight or volume
- Material waste due to remote procurement risk
- Extra material for difficult resupply
- Weather protection quantities
- Temporary heat duration
- Winter protection
- Equipment mobilization
- Crew travel days
- Lodging duration
- Barge or ferry shipment packaging
- Backhaul or disposal quantities

Remote work often requires estimating more than installed quantities.

---

## Engineer Quantity Reconciliation Checklist

For each engineer-provided quantity:

- Match it to an existing estimate line if possible.
- Determine if it updates, splits, duplicates, or adds scope.
- Check whether it belongs in base scope or alternate scope.
- Check whether related excavation, backfill, fittings, supports, wiring, or startup are included.
- Note conflicts with drawings or schedules.
- Avoid double counting broad allowances.

Use this table:

| Quantity Item | Provided Qty | Unit | Existing Match | Action | Verification Needed |
|---|---:|---|---|---|---|

---

## Quantity Assumption Language

Use concise assumption notes.

Examples:

```text
ASSUMPTION: Quantity scaled from 65% plans.
ASSUMPTION: Includes 10% waste.
ASSUMPTION: Includes pipe fittings as part of unit price.
VERIFY: Final door schedule not provided.
VERIFY: Engineer quantity differs from plan takeoff.
ALLOWANCE: Quantity not shown; included as 1 LOT pending design development.
```

---

## Final Quantity QC Table

Use this table for a final quantity review:

| Line Item | Quantity | Unit | Quantity Source | Check Result | Notes |
|---|---:|---|---|---|---|

Check Result values:

- OK
- Update Required
- Duplicate Risk
- Missing Quantity
- Unit Issue
- Verify

---

## Final Quantity Checklist

Before finalizing quantities, verify:

- Quantities are assigned to correct sections.
- Units are consistent.
- `LOT` is used instead of `LS`.
- Waste is included or excluded intentionally.
- Engineer quantities are reconciled without duplication.
- Alternates are separated from base scope.
- Alaska freight and handling quantities are considered.
- Assumed quantities are clearly noted.
- Conflicting quantities are flagged.
- Quantities are appropriate for the design level.
