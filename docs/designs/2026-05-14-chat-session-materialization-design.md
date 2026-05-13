# Chat Session Materialization Design

## Problem

Reloading `/chat` must represent a new unsaved conversation, not a fake frontend session.

The old flow mixed a frontend draft key into the real NCP session key path. That caused the conversation hook to treat `/chat` as an existing backend session and request:

```text
GET /api/ncp/sessions/<frontend-draft-id>/messages
```

When the backend did not have that session, the route returned `404 ncp session not found`.

## Decision

The frontend does not generate NCP session ids for new chat sends.

The existing send endpoint remains the single product entry:

```text
POST /api/ncp/agent/send
```

Only this client-facing send boundary may accept a draft send envelope without `sessionId`. Before the request enters the strict NCP runtime/backend contract, `AgentRuntimeManager` creates a real session through `SessionManager.createSession(...)` and materializes a full `NcpRequestEnvelope`.

## Ownership

`AgentRuntimeManager` is the materialization owner because it has the required information and dependencies:

- access to `SessionManager`
- access to the active NCP backend
- access to kernel session update notification
- knowledge of request metadata such as agent, runtime, model, thinking level, project root, and requested skills

`DefaultNcpAgentBackend` stays strict. It receives `NcpRequestEnvelope` only and does not create session ids.

`NcpMessage.sessionId` stays required for canonical, persisted NCP messages.

## Flow

```text
/chat root
  -> frontend sends NcpAgentSendEnvelope without sessionId
  -> POST /api/ncp/agent/send as SSE
  -> AgentRuntimeManager materializes session via SessionManager.createSession
  -> DefaultNcpAgentBackend.send receives NcpRequestEnvelope with sessionId
  -> SSE emits message.sent / run.started with backend sessionId
  -> frontend replaces /chat with /chat/:sessionId without resetting the active conversation manager
```

## Frontend Rules

- Root `/chat` has no real `sessionKey`.
- Conversation hydration does not fetch messages when `sessionId` is missing.
- Sending from root does not attach `sessionId`.
- The route is updated only after the backend emits a real materialized session id.
- Route replacement after first send must not reset the active in-memory conversation state.

## Acceptance

- Reloading `/chat` does not request `/api/ncp/sessions/<draft>/messages`.
- A root send over `POST /api/ncp/agent/send` can omit `sessionId`.
- The response stream includes an NCP event with a backend-created `sessionId`.
- The strict backend/runtime path still receives a required `sessionId`.
