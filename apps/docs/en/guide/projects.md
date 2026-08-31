# Inspect project progress and materials

The Projects page brings together work items, artifacts, Skills, context, and AI reports for a registered project. It works for long-running writing, research, investment analysis, software development, and other work that grows across many sessions.

## Open a project home

Create a project or add an existing directory from the Chat sidebar. In project view, select the project name to open its project home; the leading icon only expands or collapses that project's sessions. The project home shows five areas:

- **Overview**: the project summary, attention items, source health, and recent changes;
- **Work items**: AI-reported work shown as a list, board, or Gantt view;
- **Artifacts**: project files matched by configuration or reported by AI;
- **Skills**: Skills available from the project directory;
- **Working rules**: references to vision, rules, and other context files.

These are read-only observations. The Projects page does not create tasks, change stages, edit files, or install Skills. Confirm and reject actions appear only when AI explicitly reports that it is waiting for a reply. That reply is sent to the source session, and AI reports the eventual state.

## Set up project observation for the first time

Configuration is not a prerequisite. When no usable `.nextclaw/project.yaml` exists, Overview offers **Let AI set up project observation**. It reuses the ordinary new-chat flow, automatically selects the current project, and pre-fills a guided draft. It does not send the message automatically, and there is no separate project-binding step.

You can add context before sending. The built-in project observation setup Skill inspects existing materials, sessions, and Skills, then directly proposes one editable setup: a lifecycle and stages for an **individual work item**, artifact categories and paths, and three linked project assets—`.nextclaw/project.yaml`, the minimal always-on root `AGENTS.md` rule, and the daily method in `.agents/skills/project-work-tracking/SKILL.md`. Unless the project already has a confirmed custom workflow, setup recommends the same `general-work` lifecycle. Software, writing, and research projects interpret the stages in context instead of inventing separate workflows; established project conventions remain intact.

A Workflow describes how one item of work moves from start to delivery and can be reused by many work items. It is not the macro lifecycle of the whole project. For example, “whole-book concept, worldbuilding, manuscript, publication” is project-level progress, while “define the goal, draft, revise, finalize” is a work-item Workflow for a chapter or setting task. Project roadmaps and milestones remain in vision, roadmap, or planning documents; V1 does not place them on the work-item board.

The default lifecycle is Explore and clarify → Plan and decompose → Design → Proposal review → Execute and produce → Verify results → User acceptance. These stages are observable coordinates that may be skipped or revisited, not a mandatory checklist. The final two stages have different owners: AI may verify the result, but verification only moves the active work item to User acceptance. The item becomes complete only after the user has seen and explicitly accepted the result, including through the existing confirmation action. Requested changes keep the same work-item ID and move it back to the stage where work resumes.

Setup is not a long questionnaire. When the project is completely empty and the user has not described a goal, AI asks only what the project is meant to do or produce; it does not silently assume software, research, or writing. Once it has that one-line goal, it proposes the complete setup directly. Setup normally takes one confirmation, or one small revision followed by confirmation. Only then does AI write and verify all three assets through the normal file-edit flow. The YAML is machine-readable by Projects, the root rule reliably routes each Agent to the project tracking Skill, and that Skill progressively supplies the full syntax and project-specific method. Unsupported rules such as TODO/Issue filters or semantic body matching are not presented as executable configuration.

## Start project work

When a project has usable configuration but no observed work items, Overview and Work items offer **Start project work**. This also reuses the ordinary new-chat flow: it selects the current project and pre-fills an editable draft. You can instead use the existing project picker in any new chat; both paths enter the same conversation flow.

After setup, the project-owned `.nextclaw/project.yaml`, root `AGENTS.md`, and project-local `project-work-tracking` Skill keep observation active. The configuration carries the workflow, artifact scope, and protocol declaration; the root rule provides reliable activation; the project Skill owns the daily method. The built-in `project-observation-setup` Skill is used only to establish or maintain those assets. Projects does not create a special chat type, runtime-injection path, `requested skills`, or extra Skill-tracking metadata.

## Optional project configuration

Create `.nextclaw/project.yaml` in the project root to declare a summary, full context files, workflows, artifact locations, and Skill roots. A complex goal does not need to fit in one sentence: reference the authoritative vision or working-rules file instead.

```yaml
schema_version: 1

project:
  summary: A long-running research project
  context:
    - id: vision
      role: Vision
      source: docs/VISION.md
    - id: working-rules
      role: Working rules
      source: AGENTS.md

workflows:
  - id: general-work
    label: General work-item lifecycle
    stages:
      - id: exploration
        label: Explore and clarify
      - id: planning
        label: Plan and decompose
      - id: design
        label: Design
      - id: proposal-review
        label: Review the proposal
      - id: execution
        label: Execute and produce
      - id: verification
        label: Verify results
      - id: acceptance
        label: User acceptance

observation:
  markers:
    - protocol: nextclaw.project/v1
  artifacts:
    - id: reports
      label: Research reports
      include:
        - reports/**/*.md
  skills:
    - root: .agents/skills
```

Configuration is not required to open a project page. Without it, the page still shows registration details and sessions or Skills that can be attributed to the project. It does not invent work items, stages, artifacts, or dates when evidence is missing. Artifact categories currently use only paths or globs; work items require an AI Marker when a real state changes. The recommended path is to complete the full setup from the page. If you create the YAML manually, also establish the concise root `AGENTS.md` entry and the project-local `project-work-tracking` Skill so future AI knows how to follow the convention.

## How AI reports project facts

The root rule tells AI to load the project tracking Skill before substantive work. A Marker means “enter this stage now” and must appear before the analysis, tool calls, or file edits for that stage; stages are never batched at the end. For example:

```text
[nextclaw.project/v1 id=wi_7km4q2x9dn name="Finish the research report" stage=exploration]
[nextclaw.project/v1 stage=execution]
[nextclaw.project/v1 artifact path="reports/final.md" category=reports]
```

The current work item, name, and workflow are inherited within a session, so a stage transition reports only what changed. Switching work items or starting a new session requires the stable random ID again. AI verification only enters `acceptance`; `completed` is emitted only after the user has seen and explicitly accepted the result. Historical verbose V1 Markers remain readable.

The page keeps the source session and observation time, and distinguishes AI reports, file observations, project configuration, and system records. An invalid marker, malformed configuration, or escaping path produces a diagnostic without taking down the rest of the page.

## Read the same snapshot from the CLI

```bash
nextclaw projects observe /absolute/path/to/project --json
```

The CLI and Projects page read the same Kernel snapshot. This is useful for scripts, agents, and headless environments. The command accepts only registered project roots and does not create project data.
