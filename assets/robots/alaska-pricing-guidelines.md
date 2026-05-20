# Alaska Pricing Guidelines

This file defines baseline Alaska-specific pricing guidance for LLM-assisted construction estimating in EstimatorLab.

Use this guide when creating, editing, reviewing, or updating construction estimates for projects located in Alaska.

These guidelines apply unless project-specific pricing, quotes, wage rates, freight information, owner direction, or local market data provide a more specific basis.

---

## Purpose

Construction pricing in Alaska is not the same as lower-48 pricing.

Even relatively simple construction work can be affected by:

- Freight cost
- Long material lead times
- Remote site access
- Seasonal construction windows
- Weather risk
- Labor availability
- Travel and per diem
- Barge, ferry, air freight, or winter trail logistics
- Limited suppliers
- Material staging constraints
- Small crew inefficiencies
- High mobilization and demobilization costs

The purpose of this guide is to make sure LLM-generated estimates account for those conditions instead of producing generic construction pricing.

---

## Core Alaska Pricing Rule

For budgetary pricing, always consider the full delivered and installed cost.

Do not price material as only the supplier base cost.

For each meaningful material or equipment item, consider:

```text
Material Base Cost + Shipping / Freight + Handling / Receiving / Staging + Labor + Equipment + Markups
```

At minimum, include:

- Material base cost
- Shipping / freight
- Handling fees or staging allowance
- Labor

If exact shipping data is unavailable, apply a reasonable budgetary freight assumption based on location, delivery method, distance, size, weight, and project constraints.

Clearly flag freight assumptions.

---

## Default Labor Rates

Use Anchorage labor rates unless project-specific rates are provided.

| Trade | Rate |
|---|---:|
| Civil | $82/hr |
| Architectural | $87/hr |
| Structural | $90/hr |
| Mechanical | $92/hr |
| Electrical | $96/hr |

These are estimating rates and should generally be treated as burdened budgetary rates.

Adjust labor hours, not just labor rates, for remote work and difficult conditions.

---

## Labor Productivity Adjustments

Alaska pricing often requires an upward adjustment to labor man-hours.

Apply productivity impacts for:

- Remote work
- Winter work
- Cold-weather protection
- Limited daylight
- Restricted access
- Small crews
- Small project inefficiency
- Crew travel time
- Material staging and double handling
- Barge or ferry delivery schedules
- Work in occupied facilities
- Security, badging, or federal site access
- Short construction windows
- Weather downtime
- Limited availability of specialized subcontractors

Do not assume urban lower-48 production rates unless the project is clearly comparable.

---

## Suggested Productivity Multipliers

Use these as budgetary guidance when no project-specific productivity factor is available.

| Condition | Suggested Labor Productivity Multiplier |
|---|---:|
| Anchorage / road system, normal conditions | 1.00x – 1.10x |
| Mat-Su / Kenai / road-access regional work | 1.05x – 1.15x |
| Interior road-access work | 1.10x – 1.25x |
| Southeast Alaska with ferry or barge dependence | 1.15x – 1.35x |
| Rural community with scheduled barge access | 1.25x – 1.60x |
| Fly-in community | 1.40x – 1.90x |
| Winter work or shoulder-season risk | Add 1.10x – 1.30x as applicable |
| Occupied facility / restricted access | Add 1.10x – 1.25x as applicable |
| Very small scope / inefficient crew loading | Add 1.10x – 1.40x as applicable |

Do not stack multipliers blindly. Use judgment and explain the assumption.

Example:

```text
ASSUMPTION: Labor hours increased 25% for Southeast Alaska barge logistics, limited staging, and crew inefficiency.
```

---

## Freight and Shipping Guidance

Freight is a major cost driver in Alaska estimates.

Consider:

- Origin of material
- Whether material is sourced from Anchorage, Seattle, or another supplier
- Overland freight to Anchorage
- Barge or ferry to coastal communities
- Air freight for urgent or high-value small items
- Trucking from port to site
- Offloading equipment
- Receiving and storage
- Double handling
- Weather delays
- Fuel surcharges
- Oversized or overweight loads
- Hazmat restrictions
- Freeze protection during transit

Do not ignore freight on heavy, bulky, fragile, or long-lead items.

---

## Budgetary Freight Assumptions

Use project-specific quotes whenever available.

When quotes are not available, use reasoned budgetary assumptions.

Potential freight approaches include:

### Percentage of Material Cost

Useful for early design or mixed material scope.

| Location / Condition | Budgetary Freight Range |
|---|---:|
| Anchorage, normal supplier delivery | 3% – 8% |
| Mat-Su / Kenai road-access | 5% – 12% |
| Interior road-access | 8% – 15% |
| Southeast Alaska barge / ferry | 12% – 25% |
| Rural barge-served community | 20% – 40% |
| Fly-in community | 35% – 100%+ |

### Per Ton Freight

Useful for heavy civil materials, pipe, steel, equipment, and bulk supplies.

Budget per-ton freight should reflect:

- Trucking distance
- Barge leg
- Ferry constraints
- Backhaul limitations
- Offloading and local hauling
- Minimum shipment charges

For budgetary work, do not assume a simple linehaul rate is the final delivered cost.

### Lump Sum Freight Allowance

Use a `LOT` freight allowance when:

- The material list is not fully defined
- Equipment is mixed and supplier unknown
- Freight requires multiple modes
- Delivery constraints are project-specific

Example:

```text
Freight and material handling allowance – 1 LOT
```

Note:

```text
ASSUMPTION: Budgetary allowance for mixed material freight to remote project site; final cost to be confirmed by vendor quotes.
```

---

## Handling, Receiving, and Staging

Include handling costs where material delivery is not straightforward.

Handling may include:

- Receiving at Anchorage warehouse
- Consolidation
- Palletizing or crating
- Barge staging
- Port handling
- Forklift or crane offload
- Local trucking
- Temporary storage
- Weather protection
- Double handling on site
- Material movement from laydown area to work zone

For remote estimates, handling is often a real cost and should not be ignored.

---

## Remote Site Logistics

Remote projects may require separate line items or allowances for:

- Mobilization / demobilization
- Crew travel
- Lodging
- Per diem
- Camp facilities
- Temporary power
- Temporary heat
- Temporary water
- Temporary sanitation
- Satellite internet or communications
- Tool and equipment mobilization
- Fuel delivery
- Waste disposal and backhaul
- Material storage
- Weather protection
- Site security
- Local transportation

These costs may belong in General Requirements rather than individual trade lines, but they must be included somewhere.

---

## Mobilization and Demobilization

Mobilization costs in Alaska may be substantial.

Include costs for:

- Project startup
- Crew travel
- Equipment transport
- Tool trailers
- Site setup
- Temporary facilities
- Freight coordination
- Material staging
- Demobilization
- Cleanup
- Equipment return

For road-system work, mobilization may be moderate.

For remote work, mobilization may be one of the largest cost categories.

---

## Seasonal and Weather Impacts

Alaska estimates should consider seasonal constraints.

Potential cost impacts include:

- Short construction season
- Winter shutdown
- Winter conditions
- Frozen ground
- Thaw settlement
- Wet spring access
- Limited barge season
- Limited ferry scheduling
- Snow removal
- Temporary heat
- Concrete cold-weather protection
- Ground thawing
- Enclosures
- Weather days
- Reduced productivity from PPE and cold conditions

If the schedule is unknown, include a budgetary assumption.

Example:

```text
ASSUMPTION: Pricing assumes summer construction season. Winter conditions, ground thaw, and temporary heat are excluded unless noted.
```

---

## Material Pricing Guidance

Material costs should include the delivered-to-site condition, not just the catalog price.

For each material category, consider:

- Base supplier cost
- Waste factor
- Freight
- Handling
- Storage
- Damage risk
- Long lead time
- Escalation
- Substitution risk
- Minimum order quantities

For long-lead equipment, consider adding:

- Expedited freight risk
- Vendor startup
- Factory testing
- Field commissioning
- Spare parts
- Special tools
- Controls integration

---

## Equipment Pricing Guidance

Construction equipment pricing should account for:

- Rental rate
- Mobilization
- Demobilization
- Fuel
- Operator if applicable
- Maintenance
- Attachments
- Standby time
- Weather downtime
- Minimum rental duration
- Delivery to remote site

Remote equipment mobilization can exceed the rental cost for short-duration work.

Do not price equipment as if it is always locally available.

---

## Subcontractor Pricing Guidance

For specialty subcontractors, consider:

- Travel
- Lodging
- Per diem
- Minimum trip charges
- Small job premiums
- Mobilization
- Specialized tools
- Schedule constraints
- Limited availability
- Markup over lower-48 vendor pricing

Examples of specialty scopes that may need subcontractor premiums:

- Controls / SCADA
- Fire alarm
- Sprinklers
- Specialty HVAC balancing
- Testing and commissioning
- Geotechnical testing
- Concrete testing
- Hazardous materials abatement
- Roofing
- Elevator or lift work
- Process equipment startup

---

## General Requirements Guidance

General Requirements should be priced explicitly when possible.

Common Alaska General Requirements include:

- Project management
- Superintendent
- Field engineering
- Quality control
- Safety
- Submittals
- Closeout
- Temporary facilities
- Temporary utilities
- Temporary heat
- Temporary toilets
- Dumpsters and waste disposal
- Surveying
- Testing coordination
- Mobilization / demobilization
- Travel and per diem
- Lodging or camp
- Site access and logistics
- Material staging and freight coordination
- Weather protection
- Winter protection
- Equipment mobilization

At later design levels, General Requirements should be broken down into dollar values where practical rather than left only as a percentage.

---

## Contingency Guidance

Use contingencies based on design maturity and project uncertainty.

Potential contingency categories:

- Design contingency
- Construction contingency
- Owner contingency
- Escalation contingency
- Remote logistics contingency
- AIS / BABAA or funding compliance contingency where applicable

Do not mix all contingencies together if the estimate needs transparency.

Label each contingency clearly.

Suggested design contingency ranges:

| Design Level | Budgetary Design Contingency |
|---|---:|
| Concept / ROM | 25% – 40% |
| 30% | 20% – 30% |
| 35% / PER | 20% – 30% |
| 65% / 70% | 10% – 20% |
| 95% | 5% – 10% |
| Final / Bid-Level | 0% – 5% |

Use project-specific guidance when available.

---

## Escalation Guidance

Include escalation when the construction start date is not current or when procurement is expected later.

Consider escalation for:

- Steel
- Copper
- Fuel
- Electrical gear
- Mechanical equipment
- Process equipment
- Pipe
- Lumber
- Concrete
- Aggregate
- Labor
- Freight

When escalation is included, identify:

- Base pricing date
- Assumed midpoint of construction
- Escalation percentage
- Scope covered

Example:

```text
ASSUMPTION: Includes 6% annual escalation to assumed construction midpoint; verify project schedule.
```

---

## Road-System vs Remote Pricing

Not all Alaska projects are remote.

Use location-specific judgment.

### Road-System Projects

Examples include many projects in Anchorage, Mat-Su, Kenai, Fairbanks, and other connected communities.

Typical impacts:

- Moderate freight premium
- Better labor availability
- Easier equipment access
- Lower lodging costs if local labor is available
- Seasonal impacts still apply

### Coastal / Ferry / Barge Projects

Examples include many Southeast Alaska projects and coastal communities.

Typical impacts:

- Barge or ferry-dependent freight
- Schedule risk from sailings
- Higher material handling
- Higher mobilization
- Limited equipment availability
- Lodging and per diem may be required

### Fly-In Projects

Typical impacts:

- Very high freight cost
- Limited equipment size
- High crew travel cost
- Camp or lodging requirements
- Strong need for material consolidation
- High risk for missing materials
- Weather delays
- Backhaul costs

---

## Pricing Notes by Common Scope Type

### Civil / Sitework

Consider:

- Clearing and grubbing
- Topsoil stripping
- Excavation
- Rock excavation if indicated
- Dewatering
- Bedding
- Backfill
- Compaction
- Imported material
- Local borrow availability
- Haul distance
- Disposal
- Surface restoration
- Surveying
- Erosion control
- Winter earthwork impacts

Remote civil work may require high equipment mobilization and imported aggregate premiums.

### Concrete

Consider:

- Batch plant availability
- Trucking distance
- Pumping
- Cold-weather protection
- Heating blankets
- Ground thaw
- Forms
- Reinforcing
- Embedments
- Finishing
- Testing
- Waste factor

In remote areas, concrete may require on-site batching, super sacks, or high logistics costs.

### Metals

Consider:

- Fabrication location
- Galvanizing
- Paint or coating
- Freight by weight and dimension
- Crane or forklift offload
- Field welding
- Bolting
- Special inspection

### Architectural

Consider:

- Freight damage risk
- Minimum order quantities
- Finish protection
- Hardware coordination
- Interior work productivity in occupied buildings
- Remote subcontractor availability

### Mechanical

Consider:

- Equipment freight
- Controls integration
- Startup
- Testing and balancing
- Insulation
- Heat trace
- Freeze protection
- Spare parts
- Vendor support

### Electrical

Consider:

- Long-lead gear
- Conduit and wire freight
- Lighting packages
- Controls and communications
- Fire alarm
- Generator systems
- Fuel systems
- Startup and testing
- Utility coordination

### Water / Wastewater / Process

Consider:

- Process equipment freight
- Vendor startup
- Controls / SCADA
- Instrumentation
- Testing
- Bypass pumping
- Temporary service
- Confined space constraints
- Corrosion-resistant materials
- Coatings
- Commissioning
- Operator training

---

## Budgetary Assumption Language

Use concise assumption notes.

Examples:

```text
ASSUMPTION: Material pricing includes base cost, freight to Anchorage, barge delivery to site, and local handling.
ASSUMPTION: Labor productivity increased 30% for remote logistics and limited staging.
ASSUMPTION: Pricing assumes summer construction; winter conditions excluded unless noted.
ASSUMPTION: Equipment mobilization included as LOT due to remote site access.
VERIFY: Freight mode and delivery point not identified in documents.
VERIFY: Local aggregate source availability not confirmed.
```

---

## Exclusion Language

Use clear exclusions where appropriate.

Examples:

```text
EXCLUSION: Winter conditions excluded unless specifically noted.
EXCLUSION: Hazardous materials abatement not included.
EXCLUSION: Utility company fees not included.
EXCLUSION: Rock excavation excluded unless shown or specified.
EXCLUSION: Premium freight for expedited delivery excluded.
EXCLUSION: Owner-furnished equipment excluded from material cost.
```

---

## Remote Logistics Risk Checklist

Before finalizing a remote Alaska estimate, check whether the estimate includes or addresses:

- Crew travel
- Lodging / camp
- Per diem
- Equipment mobilization
- Tool mobilization
- Freight consolidation
- Barge / ferry / air freight
- Offload equipment
- Local trucking
- Material storage
- Weather protection
- Fuel delivery
- Waste disposal
- Backhaul
- Communications
- Temporary power
- Temporary heat
- Schedule risk
- Missing material risk
- Startup and commissioning travel

---

## Pricing Transparency Requirement

When the LLM generates pricing, it should make clear what the price represents.

Good pricing note:

```text
ASSUMPTION: Unit cost includes material base cost, 18% freight and handling allowance, and Anchorage labor with 20% productivity increase for remote logistics.
```

Poor pricing note:

```text
Estimated.
```

---

## Final Guidance

Alaska estimating requires judgment.

When exact pricing is not available, provide a reasonable budgetary estimate, but clearly state the assumptions.

The final estimate should make it possible for another estimator to understand:

- What is included
- What is excluded
- What was assumed
- What needs verification
- How Alaska logistics were accounted for

Do not hide freight, handling, mobilization, or remote productivity impacts inside unexplained numbers.
