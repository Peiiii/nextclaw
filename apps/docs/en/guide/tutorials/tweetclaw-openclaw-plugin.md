# TweetClaw OpenClaw Plugin

Use this recipe when you want a concrete OpenClaw plugin workflow inside NextClaw for X/Twitter research and approved posting.

TweetClaw is the OpenClaw plugin for the Xquik API. It can search tweets, search tweet replies, export followers, look up users, monitor tweets, handle media upload or media download, send direct messages, and run giveaway draws. Treat write actions such as post tweets and post tweet replies as approval-gated tasks.

## When to use it

- you need an X/Twitter automation plugin instead of a prompt-only skill
- you want repeatable tweet search or reply search from a NextClaw session
- you want follower export or user lookup before a marketing or support workflow
- you want the same OpenClaw plugin path available to local and hosted operators

## Install

Install the official npm package from a terminal:

```bash
nextclaw plugins install @xquik/tweetclaw
```

The npm package is the install source. The [TweetClaw GitHub repo](https://github.com/Xquik-dev/tweetclaw) and [npm package](https://www.npmjs.com/package/@xquik/tweetclaw) are the best places to verify the current version and README. The [ClawHub listing](https://clawhub.ai/plugins/@xquik/tweetclaw) is useful for discovery.

## Configure credentials

TweetClaw can install before credentials exist. Configure credentials only in your local secret store or environment, not in prompts, Markdown files, screenshots, or shared chat history.

Use the Xquik API key as a secret named `XQUIK_API_KEY` for normal API access. If you use Machine Payments Protocol for read-only endpoints, keep the signing key in the same secret boundary.

Reload or restart NextClaw after changing runtime secrets so the plugin process sees the new values.

## Verify

Start with read-only checks:

```bash
nextclaw plugins list
nextclaw plugins info tweetclaw
```

Then run one low-risk task in chat:

```text
Use TweetClaw to search tweets about "NextClaw OpenClaw plugin" and return 5 tweet URLs, authors, timestamps, and short relevance notes.
```

For reply research:

```text
Use TweetClaw to search tweet replies for this public tweet URL. Summarize recurring questions, complaints, and useful reply examples. Do not post or send messages.
```

## Approval boundaries

Keep these actions read-only by default:

- search tweets
- search tweet replies
- follower export
- user lookup
- media download
- monitor tweets
- webhook review
- giveaway draw inspection

Require explicit operator approval before these actions:

- post tweets
- post tweet replies
- media upload
- direct messages
- webhook creation or delivery changes
- bulk follower export outside a reviewed task

## Team workflow

1. Search tweets or tweet replies for the campaign, support topic, or launch keyword.
2. Save only public tweet URLs, IDs, handles, timestamps, and reviewed summaries in the session.
3. Ask the agent to draft replies or posts as proposals.
4. Review the proposed text and target account.
5. Approve a single write action only after the draft is final.

## Troubleshooting

If the plugin installs but does not appear in chat, run `nextclaw plugins list` and confirm the plugin is enabled. If the tool appears but live calls return setup guidance, verify `XQUIK_API_KEY` is available to the NextClaw runtime and restart the service.

If you only need task instructions and not live API calls, use a skill instead. If you need live X/Twitter data, use the plugin.

## Related docs

- [Skills Tutorial](/en/guide/tutorials/skills)
- [MCP Marketplace](/en/guide/tutorials/mcp-marketplace)
- [Secrets Management](/en/guide/secrets)
- [Command Index](/en/guide/commands)
