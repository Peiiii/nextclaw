---
"nextclaw": patch
---

Track the managed service runtime child PID after readiness so in-app runtime update apply can stop and relaunch the real serving process instead of only the launcher wrapper.
