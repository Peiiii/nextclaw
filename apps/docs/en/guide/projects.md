# Manage project work and materials

The Projects page brings together work items, artifacts, Skills, working agreements, and project sessions for a registered project. A project still has a real root directory, but NextClaw stores work-item data separately. You do not need tracking files or a dedicated tracking Skill in the project directory.

## Open a project home

Create a project or add an existing directory from the Chat sidebar, then select the project name. The page keeps the existing Artifacts, Skills, Working agreement, and project-session capabilities while adding a work summary, list, and board.

Overview treats Current work and Recent artifacts as equal primary regions: they sit side by side in a wide layout and stack only in a narrow layout. Recent artifacts come from files explicitly linked to work items. Overview does not scan the project directory, read messages, or replay session history for either region. The complete Artifacts, Skills, and Working agreement views still load on demand.

## Remove a project from the list

When you no longer need a project in NextClaw, switch the session list to the project view, open the project's **More actions** menu, and select **Remove from project list**. A confirmation explains the impact before the project is removed.

This removes only the project-list entry. It does not delete the local folder, previous sessions, or Project Work. Existing sessions remain available in the session list. Adding or binding the same folder again restores the original project and its work records.

The CLI uses the same safety contract and requires the confirmation value to exactly match the project ID:

```bash
nextclaw projects remove <project-id> --confirm <project-id> --json
```

## Create and advance work items

Create an item from **Work items**. A project receives these general-purpose states on first use: Backlog, Planned, In Progress, In Review, Awaiting Acceptance, Completed, and Canceled. Built-in state names follow the interface language; renamed states keep the name you set.

You can rename and reorder states or add project-specific ones. Each state maps to one stable lifecycle category: backlog, unstarted, started, completed, or canceled. This keeps summary counts consistent while letting each project customize its workflow. When deleting a state that still has items, select a migration destination first.

State changes append to an immutable activity timeline instead of replacing history. For example, moving from In Progress to In Review, back for changes, and into review again remains visible as three separate transitions.

The list groups items by the project's custom states. Each state shows its server-side total, can be collapsed, and loads additional pages independently. The board reuses the same state groups, ordering, and pagination instead of downloading every item and splitting it in the browser.

Every work item shown in Overview, the list, or the board is clickable. All of them open the same right-side detail drawer instead of appending a flat detail panel to the page. In the drawer you can:

- edit the title, description, state, and attention flag;
- inspect the complete activity timeline;
- soft-delete or restore the item;
- link or unlink artifact files inside the project and open linked files directly.

## How AI uses work items

Project Work tools are available only to sessions that belong to a project. AI can list, inspect, create, and update work items and manage artifact links. Sessions without a project do not receive these tools.

A work item represents a user intention or deliverable worth tracking over time. Temporary execution steps and run plans are outside this feature; Project Work does not replace a run plan.

Committed changes publish real-time notifications so the page can refetch current data. Events mean only that something changed. They are not the database, and consumers do not replay event history.

## Data and project-directory boundaries

NextClaw stores work items, states, activity history, and artifact links in its own data directory. The project root remains the identity and file boundary, but work tracking never requires a dedicated file inside it.

An artifact link must point to an existing file under the project root. The database stores a project-relative path rather than a machine-specific absolute path.

## Manage work from the CLI

Unlike a project-bound session, the CLI cannot infer a current project from conversation context. Every Project Work command therefore requires a project ID:

```bash
nextclaw projects work list --project <project-id>
nextclaw projects work list --project <project-id> --state <state-id> --limit 20
nextclaw projects work create "Improve the project page" --project <project-id>
nextclaw projects work update <work-item-id> --project <project-id> --state <state-id>
nextclaw projects work activity <work-item-id> --project <project-id>
```

`work list` returns 20 items by default and at most 100. When another page exists, it returns an opaque cursor that can be passed with `--cursor`. The CLI calls the running local NextClaw service and reuses the same Kernel contract. If the service is not running, it fails directly instead of starting a second writer. See the [command reference](./commands.md) for the complete command set.

## Project material observation

The complete Artifacts, Skills, and Working agreement views read project files on demand. An optional `.nextclaw/project.yaml` configures only the project summary, context files, artifact directories, and Skill directories. Work items always come from Project Work; NextClaw does not rebuild their state from historical conversation text.

You can read the project material observation snapshot with:

```bash
nextclaw projects observe /absolute/path/to/project --json
```
