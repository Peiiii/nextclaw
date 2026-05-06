---
title: 2026-03-11 · Bocha Search Integration + Runtime Alignment
description: Bocha search integration, configurable search providers, UI activation controls, and runtime package alignment.
---

# 2026-03-11 · Bocha Search Integration + Runtime Alignment

Published: March 11, 2026  
Tags: `new feature` `improvement`

## What changed

- Integrated Bocha as a supported web search provider in runtime configuration.
- Added configurable web search provider support in runtime configuration.
- Added UI controls to activate and manage the search provider flow.
- Aligned runtime package behavior and exports for a more predictable dev/runtime path.

## Why it matters

- You can use Bocha search directly in the product flow without custom patching.
- You can switch search behavior without patching internals.
- Search capability becomes easier to discover and operate for non-technical users.
- Runtime alignment reduces environment-specific surprises during setup and daily use.

## How to use

1. Open configuration in the UI.
2. Go to search-related settings and set the search provider to Bocha (or another provider).
3. Save and run a search-enabled task to verify expected behavior.

## Links

- [Provider Configuration Guide](/en/guide/configuration)
- [Tools Overview](/en/guide/tools)
- [Project Roadmap](/en/project/roadmap)
