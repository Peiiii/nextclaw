# Keep an agent focused

When a connected service exposes status or events, you can have an agent keep following the same session: include the latest state when the session continues, or bring an important event back into that session.

Continuous attention depends on an installed Extension exposing something the session can follow. Ask the agent, “What is this session keeping track of?” It will look for available Extensions and explain when none fit.

## Two ways to keep a session in view

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

Once delivered, the event appears in the session timeline like a normal message, with a dedicated **External event** card. The card shows the event type, source Extension, occurrence time, and event ID. Its payload is collapsed by default and can be expanded when needed. It is not presented as a user utterance, but it shares the same conversation order so you can see exactly which event triggered the run.

## Ask the agent to set it up and manage it

You do not need to remember implementation commands. Tell the agent what you want to follow, what noise to ignore, and when it should continue the session.

You can say things like:

- “Show what this session is keeping track of.”
- “Pause the deployment status follow-up until I ask you to resume it.”
- “Cancel the payment-failure subscription.”
- “Keep only high-priority alerts, and do not process duplicate alerts repeatedly.”

Continuous-attention relationships belong to the current session. The agent can view, pause, resume, or remove them, but it cannot use this to change relationships in another session.

## View and manage them in a session

Open the session workspace and choose **Continuous attention** from the overview. The panel separates the current session's relationships into two groups:

- **State** shows the latest state that will be provided when the session continues;
- **Events** shows events that can be delivered back into the session when the subscription matches.

Each relationship shows its Extension, status, a safe configuration summary, and lifecycle information. You can pause, resume, or remove a relationship directly; removal requires confirmation. The workspace is scoped to the current session, and refreshes use the server's persisted state.

Global Extension installation, enablement, disablement, and removal remain in Extension/plugin management under Settings. Installing an Extension does not automatically create a relationship for any session; it appears here only after the Agent establishes one in a specific session.

## Restarts, permissions, and safety

Established continuous-attention relationships are saved with the session. After NextClaw restarts, they are restored as long as the related Extension and session are still available. If an Extension is removed, access is revoked, or the target session is no longer available, the relationship is marked unavailable so you can ask the agent to inspect it.

State and events from external services are given to the agent as data, not as new instructions. Continuous attention also does not bypass existing tool permissions or confirmation rules. Subscribe only to services you trust and are allowed to access.

Continuous attention currently works only with NextClaw's Native Agent runtime.
