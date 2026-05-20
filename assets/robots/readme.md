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
llm-context/
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
    ├── quantity-checklist.md
    ├── estimate-review-checklist.md
    ├── document-comparison-checklist.md
    └── output-validation-checklist.md
