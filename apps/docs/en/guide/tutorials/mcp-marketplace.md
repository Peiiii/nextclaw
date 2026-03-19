# MCP Tutorial (No Command Line)

This guide is for beginners.

The goal is simple:

- no terminal
- no commands
- only the NextClaw UI

You will complete one full MCP flow:

1. install
2. check
3. use it in chat

If you only want the short version, remember this:

1. open `Marketplace -> MCP`
2. click `Install`
3. run `Doctor` before trying to use it in chat

## 1) What MCP means here

MCP is a standard way to give your AI external tool capabilities.

It is not a separate chat mode.

The real flow is:

1. install an MCP server
2. verify it is reachable
3. let the agent use it as part of its toolset

So the mental model should be:

- MCP is a tool source
- chat is still where you actually use it

## 2) Open the MCP marketplace

In the left sidebar of NextClaw:

- open `Marketplace`
- then open `MCP`

You will usually see two areas:

- `MCP Market`: installable MCP items
- `Installed MCP`: MCP servers you already installed

Each card usually shows:

- name
- short summary
- transport type such as `STDIO`, `HTTP`, or `SSE`
- current status

## 3) Install one MCP

Find an item in the MCP market and click `Install`.

The install dialog usually includes:

- `Server Name`
- `Available to All Agents`
- optional input fields required by that MCP

For beginners, the safest default is:

- keep the default server name
- keep `Available to All Agents` enabled
- only change extra inputs if you clearly know what they do

After install, the item should appear in:

- `Installed MCP`

In most cases, you do not need to restart the service.

## 4) Always run Doctor first

Installed does not always mean usable.

The most important next step is:

- click `Doctor` on the installed MCP card

Pay attention to:

- `Accessible`
- `Transport`
- `Tools`

The ideal result is:

- `Accessible = true`
- `Tools > 0`

That means:

- NextClaw can reach the MCP server
- and it can already discover tools from it

If `Doctor` fails, do not assume chat will still use it correctly.

## 5) How to actually use it after that

Once `Doctor` passes, go back to chat.

Important:

- you do not open a separate “MCP chat”
- you do not switch into a special MCP mode

You just talk to the agent normally.

Examples:

- “Use the browser tools to inspect this page.”
- “Check this external service for me.”
- “Use the installed tool to verify the current state.”

If your current runtime/agent supports MCP, the installed MCP server becomes an extra tool source.

## 6) Chrome DevTools MCP as an example

`Chrome DevTools MCP` is a good example of how this works.

You can install it from the MCP marketplace without touching the command line.

But there is one important detail:

- some MCP servers depend on external programs or system state

For Chrome DevTools MCP, that usually means Chrome itself must be in a connectable state.

So the correct flow is:

1. install it in UI
2. run `Doctor`
3. if `Doctor` fails, fix the browser-side requirement first

So for beginner users:

- installation can be no-command-line
- usability still depends on the MCP's own prerequisites
- `Doctor` is the final truth

## 7) What Enable / Disable / Remove mean

After install, you will usually see actions like:

- `Disable`
- `Doctor`
- `Remove`

Think of them like this:

- `Disable`
  - temporarily stop using it
  - keep the config
  - re-enable later

- `Doctor`
  - test whether it is actually reachable and usable

- `Remove`
  - delete the MCP config entirely
  - use this if you installed the wrong one or want to start over

If you only want to pause it, use `Disable`.

If you are done with it, use `Remove`.

## 8) Beginner-friendly order

For your first MCP setup, use this order:

1. choose an official or well-documented MCP item
2. install with default values
3. run `Doctor` immediately
4. only test in chat after `Doctor` passes
5. if it fails, check the MCP's external prerequisite before blaming chat

## 9) Best next step

If this is your first time using MCP, do this:

1. open `Marketplace -> MCP`
2. choose the simplest item you understand
3. click `Install`
4. click `Doctor`
5. if it becomes accessible, go to chat and test it once

## Related docs

- [Tools](/en/guide/tools)
- [Chat Capabilities](/en/guide/chat)
- [Troubleshooting](/en/guide/troubleshooting)
- [Tutorial Hub](/en/guide/tutorials)
