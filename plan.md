# TAO Mission Control Plan

## Purpose

This repository is the working TAO fork of `beads-web`.

The goal is not only to keep a visual Beads viewer running. The goal is to turn
`beads-web` into a local-first mission control layer for TAO:

- `Beads` is the task source of truth
- `Kanna` is the agent execution and chat surface
- `beads-web` becomes the human-friendly planning and operations viewer
- `TAO` becomes a multi-repo operating system for both humans and agents

This document captures the intended direction before implementation expands.

## Product Intent

We want a system where:

- every tool or project repository can have its own Beads task database
- agents can create, update, and complete work inside those repo-local task systems
- humans can browse that work through a fast visual UI
- TAO can aggregate status across many repositories without depending on GitHub Projects as the primary planning layer
- Kanna and the task system can deep-link into each other

The long-term shape is:

- repo-local task ownership
- workspace-level visibility
- agent-native execution
- human-friendly review and planning
- minimal dependence on third-party SaaS for core operational state

## Why This Direction

GitHub Projects is useful as an external collaboration layer, but it is not the
best primary system for TAO because:

- the UX feels slower and less local
- custom planning structures are constrained by GitHub's model
- agents work better with local, scriptable state
- cross-repo local operations should not require a network roundtrip to GitHub
- TAO wants an internal operating system feel, not just a hosted project board

Beads is more aligned with the TAO model because:

- it is local-first
- it is agent-friendly
- it supports dependency-aware tasks and epics
- it fits repo-local ownership well
- it can be extended without giving up source control discipline

`beads-web` is attractive because:

- it is fast
- it ships as a single binary
- it already has strong single-project and multi-project dashboard foundations
- it is visually good enough to become a serious human-facing viewer
- it is a realistic base for a TAO-specific mission control fork

## Core Architecture

### 1. Repository Model

TAO uses four distinct layers:

- `/root/TAO/Repos/`
  - clean upstream clones
  - reference sources
  - update-friendly
  - no product-local patch carry unless explicitly approved

- `/root/TAO/Tools/`
  - TAO-owned working repositories
  - internal tools
  - maintained forks
  - local integrations and operational code

- `/root/TAO/Projects/`
  - product and business initiative spaces
  - can contain docs, assets, and code areas
  - product-first, not dependency-first

- `/root/TAO` hub metadata layer
  - workspace conventions
  - shared docs
  - planning conventions
  - not a code monorepo for all nested repositories

### 2. Task Model

The intended task model is:

- Beads is the primary task system
- tasks live close to the repository they belong to
- epics and tasks are maintained by agents and humans locally
- GitHub issues/projects become optional publication or collaboration mirrors, not the canonical planning source

### 3. UI Model

The intended UI split is:

- `Kanna`
  - agent chat
  - execution
  - repo context
  - session navigation

- `beads-web`
  - planning board
  - epic overview
  - project-level visibility
  - workspace-wide mission control views

This means the user should be able to work in one repo and quickly move between:

- current repo tasks
- current repo epics
- current agent/chat context
- cross-workspace project and epic views

## Target UX

The desired experience is:

1. Open Kanna for a repo.
2. Open tasks for that same repo with one click.
3. Jump from a task or epic back into the matching Kanna project or chat context.
4. Open a workspace-wide view that shows:
   - all projects and their status
   - all epics across registered projects
5. Filter down quickly without mixing low-level child tasks into high-level planning views.

The system should feel like an operating console, not a pile of unrelated tools.

## Kanna Integration

One of the most important product directions is two-way linking between Kanna and
the task viewer.

### Kanna -> Tasks

From a Kanna project or chat, the user should be able to open:

- the repo-local Beads board
- the current repo's epic list
- a specific task if one is associated with the current session

### Tasks -> Kanna

From a task or epic, the user should be able to open:

- the matching repository in Kanna
- ideally the relevant chat or session context
- or at minimum the repo-level Kanna page if chat-level resolution is not available

### Deep Link Direction

The first implementation only needs stable, practical deep-link contracts.

It does not need perfect semantic chat routing on day one.

The correct first target is:

- deterministic repo resolution
- useful fallback behavior
- URL contracts stable enough to build on later

## Mission Control Views

The most important missing capability in current `beads-web` is a true workspace
aggregate view.

Today it already supports:

- a project registry
- a dashboard showing many projects
- a single-project kanban board

What TAO needs next is a real level-2 view above individual repos.

### View A: Project Summary

This view should show registered projects only, with high-level status.

Possible fields:

- project name
- repo path
- source type
- open issue counts
- in-progress issue counts
- blocked issue counts
- epic counts
- ready counts
- stale activity indicators
- health or attention indicators

This should answer:

- which projects are active
- which projects are blocked
- which projects need attention

### View B: Epic-Only Cross-Project View

This view should show only epics from all registered projects.

It should intentionally avoid showing child tasks inline in the main list.

The goal is to provide a clean high-level planning surface.

Possible fields:

- epic ID
- epic title
- project name
- status
- progress
- priority
- labels
- owner
- updated_at

This should answer:

- what big work streams exist right now
- which epics are active
- which epics are stuck
- where effort is concentrated across TAO

### Important Rule

High-level views should not drown in child tasks.

Tasks belong in:

- single-project detail
- epic detail
- focused execution views

But the workspace aggregate layer should emphasize:

- projects
- epics
- signals
- filters

## Data Direction

The intended data flow is:

- each registered project points to a repo-local Beads source
- `beads-web` reads those tasks
- aggregate views enrich them with project metadata
- task rows carry enough project identity to route back to repo context

For aggregate mode, every bead should be enriched with:

- `project_id`
- `project_name`
- `project_path`
- project tags
- source type

This lets aggregate views filter and group intelligently.

## Sync And Ownership

The intended ownership model is:

- work is created inside the repo that owns it
- aggregate views never replace repo-local ownership
- workspace-level views are read-first and navigation-first
- later, selected cross-project operations may be supported

This means the workspace layer is an orchestrator and viewer, not the only write location.

## Scope Boundaries

### In Scope

- use `beads-web` as the base for TAO mission control
- keep upstream linkage clean through a real GitHub fork
- add TAO-specific planning views
- add Kanna deep-link integration
- improve multi-project usability
- make the UI good enough for daily human use

### Out of Scope For The First Phase

- replacing Kanna
- replacing Beads storage
- building a generalized enterprise multi-user SaaS
- building a perfect permissions system
- building full cross-project write orchestration from day one
- turning this into a generic product before TAO itself gets value from it

## Implementation Phases

### Phase 1: Establish Working Base

- keep upstream fork healthy
- run the release binary locally
- verify project registry flow
- validate Beads integration against real TAO repos
- document instability and friction points

### Phase 2: Define TAO-Specific UX Contracts

- define Kanna <-> tasks deep-link contract
- define project summary aggregate view
- define epic-only cross-project view
- define minimum metadata enrichment for aggregate rows

### Phase 3: Add Aggregate Read Views

- create a backend/API path for aggregate project and epic loading
- create frontend screens for:
  - workspace project summary
  - workspace epic list
- add filters for:
  - project
  - status
  - label
  - owner
  - priority

### Phase 4: Add Navigation Bridges

- Kanna -> task board deep links
- task board -> Kanna deep links
- repo-aware fallback behavior
- eventually session-aware deep links where possible

### Phase 5: Mission Control Signals

- detect stale epics
- detect blocked projects
- surface ready work across projects
- tie in heartbeat or log-derived task generation later

## Relationship To Other TAO Systems

### GitHub

GitHub should remain useful for:

- public or shared repos
- PR workflows
- upstream fork relationships
- optional external collaboration

But GitHub should not be the required primary task surface for TAO operations.

### Kanna

Kanna is the place where real execution happens with coding agents.

This fork should make planning and execution feel connected, not duplicated.

### Future Agent Systems

This viewer should eventually support workflows where:

- heartbeats suggest tasks
- operational failures create review items
- OpenClaw or Hermes can inspect the state of the system
- agents can navigate and act from a stable planning surface

## Success Criteria

This project is successful if:

- TAO can track repo-local work without relying on GitHub Projects as the main planning layer
- the user can quickly see project status across the workspace
- the user can quickly see epic status across the workspace
- Kanna and task navigation feel connected
- the system is fast enough to use daily
- the system remains local-first and agent-friendly

## Immediate Next Build Targets

The first meaningful TAO-specific deliverables should be:

1. stable local launch and project registration workflow
2. `Kanna <-> Beads` deep-link design
3. aggregate project summary view
4. aggregate epic-only cross-project view
5. metadata plumbing for cross-project navigation

## Working Principle

Do not turn this into a giant abstract platform rewrite.

Keep the fork pragmatic:

- small vertical slices
- real TAO workflows first
- upstream-friendly where practical
- TAO-specific where necessary

The product should earn complexity by becoming useful in daily operation.
