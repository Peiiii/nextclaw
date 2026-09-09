# NextClaw Vision

**NextClaw, your long-term personal AI partner.**

NextClaw has one fundamental mission: to be a good long-term partner to its user. We aim to build a proactive AI partner that continuously improves itself to fulfill that mission.

This vision describes the product we want to build; it does not mean every capability is available today. See the [Roadmap](/en/project/roadmap) for scope and milestones.

<figure>
  <a href="/vision/nextclaw-1-0-vision-zh.webp" aria-label="View the full-size NextClaw 1.0 vision illustration">
    <img src="/vision/nextclaw-1-0-vision-zh.webp" srcset="/vision/nextclaw-1-0-vision-zh-768.webp 768w, /vision/nextclaw-1-0-vision-zh.webp 1536w" sizes="(max-width: 767px) calc(100vw - 48px), 688px" width="1536" height="1024" decoding="async" alt="NextClaw 1.0 vision: one mission, to be a good partner to you. Three goals: understand the user, take useful initiative, and continuously improve itself. The partner notices a scheduling conflict and invites the user to discuss it.">
  </a>
  <figcaption>1.0 concept illustration, with Chinese text: understand you, take useful initiative, and continuously improve. Click for the full-size image; the goals are explained in English below.</figcaption>
</figure>

## Understanding What Matters to You

We want NextClaw to develop an ongoing understanding of your goals, plans across different time horizons, preferences, circumstances, and current state, using that understanding to make sense of the task at hand.

You can ask it to handle a piece of work or discuss something you have not yet figured out, develop plans, follow progress, and adjust when circumstances change. Its role as your partner continues after an individual task ends.

That understanding needs to stay current and be open to correction. You remain in charge of your goals, pace, and how much you want it to participate.

## Taking Initiative at the Right Time

NextClaw should respond to your requests and use relevant context and changes to judge when to ask a question, offer a reminder or suggestion, or act within your authorization.

For example, when a change could affect a plan you are pursuing, it could bring that change up for discussion. When nothing needs your attention, staying quiet can be the right choice.

It should also analyze what it already knows, notice conflicts between your goals and plans, compare the tradeoffs of different options, or reach out with a question worth discussing. A useful new insight can warrant a conversation even when nothing external has changed. Helping you think something through, plan ahead, or learn something important can be a complete contribution without leading to a task or tool call.

Initiative is valuable when it helps you. Sending more messages, obtaining more permissions, or collecting more data does not by itself make it a better partner.

## Improving Itself to Be a Better Partner

NextClaw should learn from experience, outcomes, and your feedback to identify weaknesses, correct its understanding of you, improve its timing and methods, and reduce repeated mistakes.

It should be able to identify opportunities to improve without waiting for you to point out every problem. Its improvement does not require you to grow alongside it or serve independent interests of its own. Its purpose remains to be a better partner to you.

We want these improvements to be observable, correctable, and reversible when needed, so you can understand and control changes that affect you.

## Providing Practical Help

A long-term partner needs to get real work done. NextClaw will continue developing the following capabilities to support that responsibility.

### A Unified Entry Point and Capability Orchestration

Use natural language and consistent controls to work with software, connect services, call tools, and complete multi-step work, with less switching between tools and repeating background information.

Where an operation can be expressed clearly in structured form, NextClaw aims to expose it through the `nextclaw` CLI so users, developers, scripts, CI jobs, and Agents can use the same product capabilities. Visual operations can remain available through the interface.

### Self-Awareness and Self-Governance

Help NextClaw understand its capabilities, runtime state, connections, outcomes, and failures, and perform configuration, extension management, diagnostics, and recovery within its authorization.

These capabilities support reliable work and help you understand what it is doing. Judging whether to take initiative also requires understanding your goals and circumstances.

### Extensions and Digital Resources

Use plugins, skills, and service connections to extend what your partner can do as needed. Work with files, local systems, the internet, and cloud resources to gather information and deliver results.

Stable protocols, runtimes, and SDKs support composition and reuse. The existing NCP infrastructure continues to support the product.

### Easy to Start and Keep Using

Help you understand what you can ask of your partner, provide the necessary background, and manage permissions when getting started. Reduce the configuration and maintenance needed for ongoing use.

## Relationship to the Personal Operating Layer

The personal operating layer for the AI era remains an important direction for NextClaw: connecting software, the internet, systems, services, and cloud computing so your partner can take practical action.

It is a way to support the partner's mission. Product progress ultimately depends on whether NextClaw understands you better, works more reliably, participates at the right time, and better supports what matters to you.
