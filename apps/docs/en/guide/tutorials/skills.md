# Skills Tutorial (Install + Use)

This is the shortest path to run skills end-to-end: install -> select -> verify.

## 1) Install one skill

```bash
nextclaw skills install <slug>
```

Example:

```bash
nextclaw skills install weather
```

If this slug is unavailable in your registry, replace it with any installable skill.

NextClaw only loads skills from the workspace `skills/` directory.

- Default workspace: `~/.nextclaw/workspace`
- Default install target: `~/.nextclaw/workspace/skills/<slug>/SKILL.md`
- If you need a project-specific workspace, pass:

```bash
nextclaw skills install <slug> --workdir <workspace>
```

After install, you should see `skills/<slug>/SKILL.md` in your workspace.

Note: upstream global commands such as `npx skills add ... -g` do not install the skill into the NextClaw workspace, so they do not make it selectable in NextClaw by themselves.

## 2) Select the skill in UI

1. Start and open UI (default `http://127.0.0.1:55667`).
2. Open chat page and click `Skills` under the input box.
3. Select the installed skill, then send a message.

## 3) Verify it is applied

- Check whether the response follows that skill's rules/format.
- Unselect the same skill and send a similar prompt again to compare.

## Related docs

- [Chat Capabilities](/en/guide/chat)
- [Tutorial Hub](/en/guide/tutorials)
- [Commands](/en/guide/commands)
