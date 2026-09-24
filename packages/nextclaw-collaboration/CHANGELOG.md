# @nextclaw/collaboration

## 0.1.5

### Patch Changes

- a35f153: Bound official-discussion polling and delivery retries, preserve safe recovery after network failures, and expose complete participant-visible discussion event coverage.

## 0.1.4

### Patch Changes

- 2e958a6: Add optional signed GitHub webhook relay reception for local collaboration, with persistent task bindings, connection health and an explicit switch back to polling.

## 0.1.3

### Patch Changes

- 71beba4: Make agent reply labels caller-configurable instead of hard-coded, keep internal identity out of reply text, and preserve signed peer controls independently of display labels.

## 0.1.2

### Patch Changes

- 460c912: Confirm accepted GitHub messages with an eyes reaction, reply to invitations and connectivity tests, and remove duplicated internal prefixes from agent replies.

## 0.1.1

### Patch Changes

- 82370b0: Connect GitHub Issues and Linear to persistent local Codex tasks using existing CLI login. See when the agent starts, continue in the same task, and pause or resume from the issue. The standalone collaboration SDK supports custom sources and consumers, signed same-account agent identities, durable recovery and migration of existing discussion bindings.
