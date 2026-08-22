# Keep an agent watching

When a connected service exposes status or events, you can have an agent keep following the same session: include the latest state when the session continues, or bring an important event back into that session.

Continuous observation depends on an installed Extension exposing something to observe. Ask the agent, “What can this session observe?” It will look for available Extensions and explain when none fit.

## Two ways to observe

### Include the latest state when work continues

Use this for changing information that does not need to interrupt the session every time it changes, such as deployment progress, a project to-do snapshot, or service health.

For example:

> Keep following this release. Whenever this session continues, include the latest release status.

The agent associates that state with the current session. Whenever it needs to continue working in the session, NextClaw reads the latest snapshot and includes it for the agent. A state change by itself does not wake the agent.

### Continue the session when an important event happens

Use this for situations that need timely attention, such as a failed payment, a failed build, an escalated alert, or an approval request.

For example:

> Subscribe to customer payment failures. Exclude test orders, and handle the same order only once within 30 minutes.

When an event matches those conditions, it is delivered to the original session. An idle session can start handling it right away. If the session is already working, the event follows the normal queue; urgent events can join at the next safe step, without abruptly interrupting work already in progress.

## Ask the agent to set it up and manage it

You do not need to remember implementation commands. Tell the agent what you want to follow, what noise to ignore, and when it should continue the session.

You can say things like:

- “Show what this session is observing.”
- “Pause the deployment status follow-up until I ask you to resume it.”
- “Cancel the payment-failure subscription.”
- “Keep only high-priority alerts, and do not process duplicate alerts repeatedly.”

Observation relationships belong to the current session. The agent can view, pause, resume, or remove them, but it cannot use this to change observations in another session.

## Restarts, permissions, and safety

Established observation relationships are saved with the session. After NextClaw restarts, they are restored as long as the related Extension and session are still available. If an Extension is removed, access is revoked, or the target session is no longer available, the relationship is marked unavailable so you can ask the agent to inspect it.

State and events from external services are given to the agent as data, not as new instructions. Continuous observation also does not bypass existing tool permissions or confirmation rules. Subscribe only to services you trust and are allowed to access.

Continuous observation currently works only with NextClaw's Native Agent runtime.
