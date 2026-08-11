# Personal Space

Personal Space brings four small, everyday apps into NextClaw without turning them into a heavyweight productivity suite:

- **Todos** — capture, prioritize, complete, edit, and delete personal tasks.
- **Notes** — keep lightweight notes as real Markdown files.
- **Favorites** — save links with a title, note, and simple tags.
- **Calendar** — manage local events and connect public ICS calendars.

The four panels share one local data service. Application code is installed by version, while personal data stays in a stable directory across upgrades, rollbacks, disable/enable cycles, and ordinary uninstall/reinstall flows.

## Privacy and permissions

Data is stored locally under NextClaw's app data directory. Each panel only declares the service actions it uses, and NextClaw asks before granting those actions. Calendar subscriptions accept public HTTP(S) ICS endpoints and enforce timeout, download-size, redirect, and private-network boundaries.

## Install

Personal Space is built into supported NextClaw releases. It can also be installed from the official Apps Registry:

```bash
napp install nextclaw.personal-organizer
```

After installation, open **Apps** in NextClaw and enable Personal Space. You can then launch Todos, Notes, Favorites, or Calendar independently.
