# Estimation LLM Context, Prompts, and Tools

This folder contains curated prompts, reusable instructions, workflow notes, and tool definitions for using LLMs in construction estimating work.

The purpose of this section is to give ChatGPT, Codex, and other LLM-based tools the project-specific and discipline-specific context they need to help create, edit, review, update, and quality-check construction estimates from drawings, specifications, narratives, prior estimate files, quantity lists, addenda, and other supporting documents.

This is a context-engineering library for estimation work.

Rather than writing a full prompt from scratch every time, this folder stores reusable context files and task files that can be referenced by an LLM when working inside the EstimatorLab repo or when assisting with estimating workflows outside the repo.

---

## Why This Folder Exists

Construction estimates depend heavily on context.

A good estimate is not only a list of prices. It depends on:

- The project location
- The design level
- The delivery method
- The drawing set and specification set
- The assumptions used at each estimate stage
- Whether the estimate is CSI, Uniformat, or another format
- The owner or agency standards
- The expected spreadsheet format
- Historical estimate structure
- Known Alaska labor, freight, seasonal, and logistics impacts
- Whether the task is a new estimate, update, review, VE exercise, or quantity reconciliation

LLMs can help with this work, but they perform best when given consistent instructions, terminology, formatting expectations, and review rules.

This folder is meant to collect those instructions in a durable, reusable way.

---

## Intended Use

The files in this folder are meant to be referenced by LLM tools such as:

- ChatGPT
- Codex
- Claude Code
- GitHub Copilot coding agent
- Other agentic or repo-aware LLM tools

These files may be used to help with:

- Building new estimates from project documents
- Updating estimates from one design level to another
- Comparing old estimates against new drawings and specifications
- Reviewing estimates for missing scope
- Checking for duplicated scope
- Reconciling engineer-provided quantities
- Formatting estimate line items in HMS style
- Creating CSI or Uniformat estimate structures
- Writing assumptions, exclusions, clarifications, and alternates
- Preparing VE pricing summaries
- Building estimating calculators and support scripts
- Creating reusable workflows for project-specific estimate reviews

---

## General Concept

This folder works like an agent instruction library.

It is similar in concept to files such as:

- `AGENTS.md`
- `CLAUDE.md`
- project memory files
- scenario files
- prompt libraries
- workflow playbooks
- tool instruction files

The idea is to store the context that should not have to be rewritten every time.

For estimating work, this includes:

- How estimates should be structured
- How line items should be written
- How quantities should be handled
- How assumptions should be flagged
- How old estimate files should be compared against new documents
- How Alaska-specific pricing concerns should be considered
- How deliverables should be formatted for easy copy/paste into estimate spreadsheets

---

## Core Estimating Principles

Unless a project-specific instruction says otherwise, LLM tools working from this folder should follow these principles.

### 1. Preserve the Estimate Format

When updating an existing estimate, preserve the current structure as much as possible.

Maintain:

- Existing tabs
- Existing page layout
- Existing CSI or Uniformat organization
- Existing section and subsection titles
- Existing HMS-style format
- Existing units and naming conventions where appropriate

Do not unnecessarily redesign the estimate.

### 2. Avoid Double Counting

When incorporating new drawings, new specs, or engineer-provided quantities, the LLM must compare new scope against the existing estimate before adding new lines.

For each new quantity or scope item:

- If already included, update the existing line
- If partially included, revise the existing line and explain the change
- If missing, add a new line item in the correct section
- If unclear, flag it as an assumption
- If scope appears duplicated, call it out before pricing it again

### 3. Use HMS-Style Line Items

Estimate output should be practical and spreadsheet-ready.

Line items should generally include:

- Section or division
- Subsection
- Description
- Quantity
- Unit
- Material unit cost
- Labor unit cost
- Total cost
- Notes or assumptions when needed

Use `LOT` instead of `LS` for lump sum items.

### 4. Respect the Design Level

The detail and confidence of the estimate should match the design level.

Examples:

- Concept / ROM: broader allowances and assumptions are acceptable
- 30%: use system-level pricing and clearly flagged assumptions
- 65% / 70%: expect more detailed line items and quantity development
- 95%: expect detailed coordination with drawings and specifications
- Final / bid-level: minimize assumptions and identify document conflicts clearly

### 5. Use Alaska-Specific Pricing Awareness

For Alaska projects, account for conditions such as:

- Freight premiums
- Remote logistics
- Barge or air freight constraints
- Seasonal construction windows
- Weather impacts
- Limited labor availability
- Mobilization and demobilization
- Anchorage labor rates unless project-specific rates are provided
- Rural or remote delivery costs when applicable
- Material handling and staging constraints

### 6. Flag Uncertainty Clearly

When documents are incomplete, unclear, or contradictory, do not hide the uncertainty.

Use clear notes such as:

- `ASSUMPTION:`
- `VERIFY:`
- `ALLOWANCE:`
- `EXCLUSION:`
- `DOCUMENT CONFLICT:`
- `QUANTITY NEEDS CONFIRMATION:`

The goal is to make the estimate usable while still showing where judgment was required.

---

## Recommended Folder Structure

The folder may contain files organized like this:

```text
robots/
├── README.md
├── global-estimating-instructions.md
├── hms-style-guide.md
├── alaska-pricing-guidelines.md
├── workflows/
│   ├── build-new-estimate.md
│   ├── update-estimate-design-level.md
│   ├── compare-old-estimate-to-new-docs.md
│   ├── reconcile-engineer-quantities.md
│   ├── value-engineering-review.md
│   ├── estimate-quality-control.md
│   └── spreadsheet-output-rules.md
├── formats/
│   ├── csi-estimate-format.md
│   ├── uniformat-estimate-format.md
│   ├── hms-line-item-template.md
│   └── assumptions-and-exclusions-template.md
├── project-types/
│   ├── wastewater-utilities.md
│   ├── water-storage-and-lift-stations.md
│   ├── trails-and-boardwalks.md
│   ├── school-facilities.md
│   ├── remote-alaska-projects.md
│   └── historic-restoration.md
├── prompts/
│   ├── new-estimate-prompt.md
│   ├── estimate-upgrade-prompt.md
│   ├── quantity-reconciliation-prompt.md
│   ├── scope-gap-review-prompt.md
│   ├── ve-pricing-prompt.md
│   └── email-clarification-prompt.md
└── tools/

File Types
Instruction Files

Instruction files describe how the LLM should behave.

Examples:

global-estimating-instructions.md
hms-style-guide.md
alaska-pricing-guidelines.md

These files should be stable and broadly applicable.

Workflow Files

Workflow files describe a repeatable estimating task.

Examples:

Build a new estimate
Upgrade a 65% estimate to 95%
Compare a prior estimate to new documents
Reconcile engineer quantities
Review an estimate for missing scope

These should be written as step-by-step procedures.

Prompt Files

Prompt files are copy/paste-ready prompts for ChatGPT, Codex, or another LLM.

They should include:

Role
Inputs
Task
Required output
Formatting rules
Review requirements
Assumptions and exclusions rules
Template Files

Template files define preferred output formats.

Examples:

CSI table layout
Uniformat table layout
Change log table
Estimate line item table
Clarification log
VE summary table
Tool Files

Tool files may describe scripts, calculators, checklists, or validation logic that support estimating workflows.

Examples:

Quantity checks
Unit conversion checks
Duplicate scope checks
Spreadsheet formatting checks
PDF/drawing review checklists
Standard LLM Behavior for Estimate Tasks

When an LLM uses these files, it should generally follow this sequence:

Identify the task type
Identify the project type
Identify the design level
Identify the estimate format required
Review the available source documents
Review the prior estimate if one exists
Extract scope from drawings, specifications, narratives, and addenda
Compare source documents against existing estimate line items
Identify added, deleted, changed, and unclear scope
Update or create estimate line items
Check for duplicate scope
Flag assumptions and exclusions
Produce output in a copy/paste-ready format
Summarize major estimate impacts
Standard Output Expectations

Unless instructed otherwise, outputs should be practical and estimator-friendly.

Preferred output formats include:

Estimate Line Item Table
Division / Section	Subsection	Description	Quantity	Unit	Material Unit Cost	Labor Unit Cost	Total	Notes
Change Log Table
Existing Line Item	Document Change	Action Required	Revised Quantity	Pricing Impact	Notes
Missing Scope Table
Source Document Reference	Missing Scope Item	Recommended Estimate Section	Quantity	Unit	Pricing Basis	Notes
Clarification Log
Item	Question	Reason It Matters	Suggested Assumption if Unanswered
Naming Conventions

Use clear file names that describe the task.

Good examples:

estimate-upgrade-65-to-95.md
hms-csi-line-item-format.md
remote-alaska-pricing-guidance.md
engineer-quantity-reconciliation.md
scope-gap-review.md

Avoid vague names such as:

prompt1.md
test.md
notes.md
general.md
Writing Style

Instructions and prompts in this folder should be:

Direct
Practical
Specific
Estimator-oriented
Written for repeatable use
Focused on real project documents
Clear about assumptions and limitations

Avoid overly generic AI language.

For example, prefer:

Compare the existing estimate against the new drawing set and identify added, deleted, revised, and unclear scope.

Instead of:

Analyze the documents and provide helpful insights.

HMS Estimating Style Notes

When producing HMS-style estimate content:

Use clear section headers
Use clear subsection headers
Use detailed line item descriptions
Use LOT instead of LS
Separate material and labor where practical
Include totals
Keep notes concise but useful
Add assumptions where documents are incomplete
Keep output easy to paste into a spreadsheet
Do not bury important scope changes in paragraph form only
CSI vs Uniformat

Some projects should be organized by CSI MasterFormat divisions.

Others should be organized by Uniformat or elemental categories.

The required format should be identified at the start of a task.

If the required format is not stated, the LLM should ask or make a reasonable assumption based on the project type and prior estimate format.

CSI Use Cases

CSI is preferred when the estimate is organized by trade or specification division.

Examples:

Division 02 – Existing Conditions
Division 03 – Concrete
Division 22 – Plumbing
Division 26 – Electrical
Division 31 – Earthwork
Division 33 – Utilities
Uniformat Use Cases

Uniformat is preferred when the estimate is organized by building system or project element.

Examples:

Substructure
Shell
Interiors
Services
Equipment
Sitework
Document Review Expectations

When reviewing project documents, the LLM should consider:

Drawings
Specifications
Narratives
Addenda
Alternates
Schedules
Owner comments
Engineer comments
Supplemental quantity lists
Prior estimates
Prior assumptions
Meeting notes or email direction

The LLM should not rely on only one document type if others are available.

For example, drawings may show a scope item that is not clearly described in the specifications, or specifications may require work not obvious on the drawings.

Estimate Update Workflow

When upgrading an estimate from one design level to another, the LLM should:

Use the previous estimate as the baseline
Review the new drawings and specifications
Identify what changed
Identify what was added
Identify what was deleted
Identify what remained generally unchanged
Update quantities and pricing where appropriate
Add new HMS-style line items for missing scope
Remove or mark deleted scope as appropriate
Flag uncertain items for review
Produce a change log
Produce copy/paste-ready estimate rows

Do not create an entirely new estimate unless the new design is effectively a new design or the user specifically requests a rebuild.

Engineer Quantity Reconciliation Workflow

When an engineer provides quantities after an estimate has already been created:

Review the engineer quantity list
Compare each quantity to the existing estimate
Determine whether the scope is already included
Update existing line items where appropriate
Add new lines only for missing scope
Flag possible duplicated quantities
Preserve the estimate layout
Document what changed

The primary goal is to incorporate the engineer’s quantities without double counting.

Value Engineering Workflow

For VE reviews, the LLM should:

Identify the original scope
Identify the proposed VE change
Determine whether the change is additive, deductive, or a substitution
Estimate the cost impact
Clearly describe what is included
Clearly describe what is excluded
Note assumptions
Provide a concise summary suitable for owner/design-team review

VE pricing should be traceable and easy to review.

Quality Control Checklist

Before finalizing estimate output, check for:

Missing major divisions or systems
Duplicated scope
Unit inconsistencies
Quantity inconsistencies
Unclear assumptions
Missing alternates
Missing mobilization or general requirements
Missing freight or logistics impacts
Missing demolition or temporary work
Missing controls, electrical, or commissioning scope
Specification requirements not shown in drawings
Drawing scope not reflected in specifications
Items shown in schedules but missing from line items
Inconsistent use of LOT vs LS
Formatting that is difficult to paste into a spreadsheet
Assumptions and Limitations

LLM-generated estimate content must be reviewed by a qualified estimator.

These files are intended to improve consistency, speed, and completeness, but they do not replace professional judgment.

The LLM may help identify scope, organize line items, compare documents, and draft pricing structure, but the estimator remains responsible for:

Final quantities
Final pricing
Final assumptions
Final exclusions
Final deliverable quality
Coordination with project documents and design team direction
Future Development Ideas

Possible future additions to this folder:

Project-specific context files
Agency-specific estimating instructions
HMS estimate template examples
Standard line item libraries
Alaska freight adjustment guidance
Remote project logistics checklists
Reusable CSI division prompts
Reusable Uniformat prompts
Spreadsheet validation scripts
PDF drawing review workflows
Quantity extraction workflows
Estimate comparison scripts
Change log generators
VE summary generators
Maintenance Notes

This folder should be updated as estimating workflows improve.

When a prompt works well on a real project, save it here.

When a prompt causes confusion, revise it.

When a new recurring task appears, create a reusable workflow file.

When project-specific assumptions become common across multiple estimates, consider turning them into a general instruction file.

The goal is to build a durable estimating knowledge base that makes future LLM-assisted estimate work more consistent, accurate, and efficient.

::contentReference[oaicite:1]{index=1}
    ├── quantity-checklist.md
    ├── estimate-review-checklist.md
    ├── document-comparison-checklist.md
    └── output-validation-checklist.md
