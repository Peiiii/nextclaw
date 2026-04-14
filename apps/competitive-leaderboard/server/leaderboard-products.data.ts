/* eslint-disable max-lines */
import type {
  CapabilityAssessment,
  CapabilityId,
  CapabilityStatus,
  InclusionCheck,
  InclusionCriterionId,
  ProductEvidence,
  ProductProfile,
  ProductSource,
  RepoStats
} from "../shared/competitive-leaderboard.types.js";

export type CapabilityAssessmentSeed = Omit<CapabilityAssessment, "points" | "maxPoints">;

export type ProductSeed = {
  product: ProductProfile;
  repoStats: RepoStats | null;
  inclusionChecks: InclusionCheck[];
  capabilityAssessments: CapabilityAssessmentSeed[];
  evidence: ProductEvidence[];
};

type CapabilitySeedInput = Partial<Record<CapabilityId, {
  status: CapabilityStatus;
  summary: string;
  evidenceIds?: string[];
}>>;

type InclusionSeedInput = Record<InclusionCriterionId, {
  passed: boolean;
  summary: string;
  evidenceIds?: string[];
}>;

const checkedAt = "2026-04-14";

const CAPABILITY_LABELS: Record<CapabilityId, string> = {
  "local-control": "本地或自托管控制",
  "web-or-admin-ui": "Web / 控制台入口",
  "multi-channel": "多渠道触达",
  voice: "语音能力",
  "scheduled-automation": "定时或后台自动化",
  extensibility: "工具 / 技能 / 插件扩展",
  memory: "记忆与个性化",
  "task-execution": "任务执行能力",
  "deployment-flexibility": "多环境部署",
  "docs-onboarding": "官方文档与上手路径"
};

const INCLUSION_LABELS: Record<InclusionCriterionId, string> = {
  "assistant-identity": "官方是否把自己定义为个人 AI 助手 / AI OS",
  "standalone-entry": "是否是独立入口产品，而不是 builder / chat UI / suite 附属功能",
  "self-hosted-or-local": "是否明确支持本地或自托管",
  "action-layer": "是否明确包含工具、自动化、任务执行或外部连接层",
  "official-docs": "是否有官方仓库、官网或官方文档可核验"
};

function repoSource(url: string): ProductSource {
  return {
    label: "Repo",
    url,
    kind: "repo"
  };
}

function docsSource(url: string): ProductSource {
  return {
    label: "Docs",
    url,
    kind: "docs"
  };
}

function siteSource(url: string): ProductSource {
  return {
    label: "Site",
    url,
    kind: "site"
  };
}

function readmeSource(url: string): ProductSource {
  return {
    label: "README",
    url,
    kind: "readme"
  };
}

function createEvidence(
  id: string,
  productId: string,
  sourceTitle: string,
  sourceUrl: string,
  summary: string,
  kind: ProductEvidence["kind"] = "fact",
  confidence: ProductEvidence["confidence"] = "high"
): ProductEvidence {
  return {
    id,
    productId,
    kind,
    confidence,
    sourceTitle,
    sourceUrl,
    checkedAt,
    summary
  };
}

function buildCapabilityAssessments(input: CapabilitySeedInput): CapabilityAssessmentSeed[] {
  return (Object.keys(CAPABILITY_LABELS) as CapabilityId[]).map((id) => {
    const seed = input[id];
    return {
      id,
      label: CAPABILITY_LABELS[id],
      status: seed?.status ?? "no",
      summary: seed?.summary ?? "官方公开资料里没有找到足够明确的公开证据。",
      evidenceIds: seed?.evidenceIds ?? []
    };
  });
}

function buildInclusionChecks(input: InclusionSeedInput): InclusionCheck[] {
  return (Object.keys(INCLUSION_LABELS) as InclusionCriterionId[]).map((id) => ({
    id,
    label: INCLUSION_LABELS[id],
    passed: input[id].passed,
    summary: input[id].summary,
    evidenceIds: input[id].evidenceIds ?? []
  }));
}

export const PRODUCT_SEEDS: ProductSeed[] = [
  {
    product: {
      id: "openclaw",
      name: "OpenClaw",
      displayName: "OpenClaw",
      category: "personal-assistant",
      comparability: "core",
      disclosure: "third-party",
      shortDescription: "多渠道、跨设备、始终在线的 personal AI assistant。",
      positioning: "官方把 OpenClaw 明确表达为运行在自己设备上的 personal AI assistant，而不是单纯 gateway 或聊天壳。",
      bestFor: "最适合把 AI 助手真正放进 WhatsApp、Telegram、Slack、Discord、Feishu 等真实入口的人。",
      caution: "产品面很厚，学习和治理成本也会高于轻量单入口产品。",
      highlight: "超强多渠道覆盖、语音、控制面和本地持有边界。",
      tags: ["channels", "voice", "self-hosted", "gateway", "always-on"],
      sources: [
        repoSource("https://github.com/openclaw/openclaw"),
        docsSource("https://docs.openclaw.ai"),
        siteSource("https://openclaw.ai"),
        readmeSource("https://github.com/openclaw/openclaw/blob/main/README.md")
      ]
    },
    repoStats: {
      repoFullName: "openclaw/openclaw",
      stars: 356373,
      forks: 72231,
      pushedAt: "2026-04-13T16:43:39Z",
      createdAt: "2025-11-24T10:16:47Z",
      homepage: "https://openclaw.ai",
      license: "MIT"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "README 直接把它定义为 personal AI assistant。",
        evidenceIds: ["openclaw-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方强调 gateway 只是 control plane，产品本体是 assistant。",
        evidenceIds: ["openclaw-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "README 明确写明 run on your own devices。",
        evidenceIds: ["openclaw-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开了大量外部渠道、语音与 live canvas 控制入口。",
        evidenceIds: ["openclaw-positioning", "openclaw-docs"]
      },
      "official-docs": {
        passed: true,
        summary: "官方仓库、官网与 docs 都公开可访问。",
        evidenceIds: ["openclaw-docs"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方明确强调运行在自己的设备上。",
        evidenceIds: ["openclaw-positioning"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "官方 docs 提供 gateway / onboarding / dashboard 路径。",
        evidenceIds: ["openclaw-docs"]
      },
      "multi-channel": {
        status: "yes",
        summary: "README 公开列出 WhatsApp、Telegram、Slack、Discord、Feishu、WeChat 等大量渠道。",
        evidenceIds: ["openclaw-positioning"]
      },
      voice: {
        status: "yes",
        summary: "README 明确写到可在 macOS、iOS、Android speak and listen。",
        evidenceIds: ["openclaw-positioning"]
      },
      "scheduled-automation": {
        status: "partial",
        summary: "公开资料强调 always-on 与控制面，但当前核心 README 对 cron 的单点说明不如其它产品直白。",
        evidenceIds: ["openclaw-docs"]
      },
      extensibility: {
        status: "yes",
        summary: "官方 onboarding 明确包含 skills 设置路径。",
        evidenceIds: ["openclaw-docs"]
      },
      memory: {
        status: "partial",
        summary: "公开入口文案更强调渠道与入口，记忆能力不是 README 的主表达。",
        evidenceIds: ["openclaw-positioning"]
      },
      "task-execution": {
        status: "yes",
        summary: "产品定位不是聊天壳，而是能在真实入口里持续回应与执行的 assistant。",
        evidenceIds: ["openclaw-positioning"]
      },
      "deployment-flexibility": {
        status: "yes",
        summary: "官方公开了 Getting Started、Docker 与跨平台安装路径。",
        evidenceIds: ["openclaw-docs"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "公开提供 docs、getting started、wizard、updating 和 FAQ。",
        evidenceIds: ["openclaw-docs"]
      }
    }),
    evidence: [
      createEvidence(
        "openclaw-positioning",
        "openclaw",
        "OpenClaw README",
        "https://github.com/openclaw/openclaw/blob/main/README.md",
        "官方 README 把 OpenClaw 定义为运行在自己设备上的 personal AI assistant，并公开列出大量消息渠道、移动端语音与 live canvas。"
      ),
      createEvidence(
        "openclaw-docs",
        "openclaw",
        "OpenClaw Documentation",
        "https://docs.openclaw.ai",
        "官方文档公开了 getting started、onboarding、Docker、showcase 和 FAQ，说明它具备完整的官方文档与上手路径。"
      )
    ]
  },
  {
    product: {
      id: "nextclaw",
      name: "NextClaw",
      displayName: "NextClaw",
      category: "operating-layer",
      comparability: "core",
      disclosure: "nextclaw-owned",
      shortDescription: "强调统一入口、浏览器控制面与多渠道接入的个人 AI 操作层。",
      positioning: "官方公开定位围绕 personal assistant 与统一入口展开，并把浏览器 UI、渠道、自动化和本地运行收在同一个产品里。",
      bestFor: "最适合想长期持有一个 AI 入口，而不是只部署一个 chat UI 的用户。",
      caution: "公共声量和社区证明仍明显弱于头部产品，榜单不应回避这一点。",
      highlight: "统一入口叙事清晰，Web UI、多渠道和自动化组合完整。",
      tags: ["operating-layer", "web-ui", "channels", "automation", "local-first"],
      sources: [
        repoSource("https://github.com/Peiiii/nextclaw"),
        docsSource("https://docs.nextclaw.io/en/"),
        siteSource("https://nextclaw.io"),
        readmeSource("https://github.com/Peiiii/nextclaw/blob/master/README.md")
      ]
    },
    repoStats: {
      repoFullName: "Peiiii/nextclaw",
      stars: 160,
      forks: 22,
      pushedAt: "2026-04-13T11:31:55Z",
      createdAt: "2026-02-10T17:45:54Z",
      homepage: "https://nextclaw.io",
      license: "MIT"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "官方 README 明确把产品表述为 omnipotent personal AI assistant。",
        evidenceIds: ["nextclaw-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方主表达是 One command + browser UI + channels 的统一入口产品，不是附属能力。",
        evidenceIds: ["nextclaw-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "README 明确写了 runs locally，并强调配置、历史和 tokens 留在本机。",
        evidenceIds: ["nextclaw-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "公开能力里包含 channels、cron / heartbeat 和插件生态兼容。",
        evidenceIds: ["nextclaw-positioning"]
      },
      "official-docs": {
        passed: true,
        summary: "官方仓库、站点与 docs.nextclaw.io 都公开可访问。",
        evidenceIds: ["nextclaw-docs"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方 README 明确写明 runs locally，配置和历史保留在本机。",
        evidenceIds: ["nextclaw-positioning"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "官方公开承诺 browser UI 作为主入口之一。",
        evidenceIds: ["nextclaw-positioning"]
      },
      "multi-channel": {
        status: "yes",
        summary: "README 公开列出 Discord、Telegram、Slack、WhatsApp、Feishu、DingTalk、WeCom、QQ、Weixin、Email。",
        evidenceIds: ["nextclaw-positioning"]
      },
      "scheduled-automation": {
        status: "yes",
        summary: "官方 README 直接列出 Cron 与 Heartbeat。",
        evidenceIds: ["nextclaw-positioning"]
      },
      extensibility: {
        status: "yes",
        summary: "README 明确写到与 OpenClaw plugin ecosystem 兼容。",
        evidenceIds: ["nextclaw-positioning"]
      },
      "task-execution": {
        status: "yes",
        summary: "公开表述强调 orchestrates the internet and raw compute to manifest user intent。",
        evidenceIds: ["nextclaw-positioning"]
      },
      "deployment-flexibility": {
        status: "yes",
        summary: "README 同时给出本地、VPS 和反代部署路径。",
        evidenceIds: ["nextclaw-docs"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "官方公开了 docs、getting started 与 configuration guide。",
        evidenceIds: ["nextclaw-docs"]
      }
    }),
    evidence: [
      createEvidence(
        "nextclaw-positioning",
        "nextclaw",
        "NextClaw README",
        "https://github.com/Peiiii/nextclaw/blob/master/README.md",
        "官方 README 将 NextClaw 表述为 omnipotent personal AI assistant，并公开列出 browser UI、10+ 消息渠道、Cron / Heartbeat、本地运行与 OpenClaw 插件生态兼容。"
      ),
      createEvidence(
        "nextclaw-docs",
        "nextclaw",
        "NextClaw Documentation",
        "https://docs.nextclaw.io/en/",
        "官方文档站提供 getting started、configuration、roadmap 等公开资料，可用于验证安装和运行路径。"
      )
    ]
  },
  {
    product: {
      id: "qwenpaw",
      name: "QwenPaw",
      displayName: "QwenPaw",
      category: "personal-assistant",
      comparability: "core",
      disclosure: "third-party",
      shortDescription: "中文工作环境适配很强的 personal AI assistant。",
      positioning: "官方把它定义为 personal AI assistant，突出本地或云部署、多聊天渠道、skills 扩展与多 agent 协作。",
      bestFor: "最适合中文办公渠道、消息入口和技能扩展都很重要的用户。",
      caution: "统一入口叙事更偏 assistant，而不是像 operating layer 那样极致集中。",
      highlight: "中文渠道、技能扩展、多 agent 和本地 / 云双部署。",
      tags: ["china-friendly", "skills", "channels", "local-or-cloud", "multi-agent"],
      sources: [
        repoSource("https://github.com/agentscope-ai/QwenPaw"),
        docsSource("https://qwenpaw.agentscope.io/"),
        siteSource("http://qwenpaw.agentscope.io/"),
        readmeSource("https://github.com/agentscope-ai/QwenPaw/blob/main/README.md")
      ]
    },
    repoStats: {
      repoFullName: "agentscope-ai/QwenPaw",
      stars: 15219,
      forks: 2053,
      pushedAt: "2026-04-13T13:18:42Z",
      createdAt: "2026-02-24T03:42:56Z",
      homepage: "http://qwenpaw.agentscope.io/",
      license: "Apache-2.0"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "官方 Repo 标题和简介都明确写了 Your personal AI assistant。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方主表达是独立 assistant 产品，而不是 builder 或附属助手。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "README 明确写本地部署或云部署，数据由用户控制。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开了 skills extension、scheduled tasks 和多 agent 协作。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "official-docs": {
        passed: true,
        summary: "官方 repo、docs 与 PyPI / 网站入口都公开可验证。",
        evidenceIds: ["qwenpaw-docs"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方强调 deploy locally or in the cloud，记忆与 personalization under your control。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "web-or-admin-ui": {
        status: "partial",
        summary: "官方快速体验强调 Console，不是强 UI-first 产品。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "multi-channel": {
        status: "yes",
        summary: "官方明确列出 DingTalk、Feishu、WeChat、Discord、Telegram 等多渠道。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "scheduled-automation": {
        status: "yes",
        summary: "官方把 scheduled tasks 作为技能组合的重要能力公开说明。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      extensibility: {
        status: "yes",
        summary: "README 明确把 skills extension 作为核心能力。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      memory: {
        status: "yes",
        summary: "README 直接写 memory and personalization fully under your control。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "task-execution": {
        status: "yes",
        summary: "官方 use cases 涵盖生产力、创作、研究与桌面文件场景。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "deployment-flexibility": {
        status: "yes",
        summary: "官方明确支持本地与云端部署。",
        evidenceIds: ["qwenpaw-positioning"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "官方 docs 提供 quick start、channel setup 和安装说明。",
        evidenceIds: ["qwenpaw-docs"]
      }
    }),
    evidence: [
      createEvidence(
        "qwenpaw-positioning",
        "qwenpaw",
        "QwenPaw README",
        "https://github.com/agentscope-ai/QwenPaw/blob/main/README.md",
        "官方 README 将 QwenPaw 定义为 personal AI assistant，并公开强调本地或云部署、多聊天渠道、skills extension、多 agent 协作和 scheduled tasks。"
      ),
      createEvidence(
        "qwenpaw-docs",
        "qwenpaw",
        "QwenPaw Documentation",
        "https://qwenpaw.agentscope.io/",
        "官方文档提供 quick start、API key 配置和渠道接入说明，支持进一步核验安装和使用路径。"
      )
    ]
  },
  {
    product: {
      id: "hermes-agent",
      name: "Hermes Agent",
      displayName: "Hermes Agent",
      category: "agent-runtime",
      comparability: "core",
      disclosure: "third-party",
      shortDescription: "强调 learning loop、消息网关和长期记忆的 agent runtime。",
      positioning: "官方把 Hermes Agent 描述成会自我改进的 AI agent，可在消息渠道与云端运行，并形成深度用户模型。",
      bestFor: "最适合看重长期自动化、云端常驻和跨会话学习能力的高级用户。",
      caution: "它更偏 runtime / TUI / gateway，产品感不如强 UI-first 方案直观。",
      highlight: "自我改进、学习回路、消息网关、cron 和跨环境执行。",
      tags: ["learning-loop", "gateway", "cron", "memory", "runtime"],
      sources: [
        repoSource("https://github.com/NousResearch/hermes-agent"),
        docsSource("https://hermes-agent.nousresearch.com/docs/"),
        siteSource("https://hermes-agent.nousresearch.com"),
        readmeSource("https://github.com/NousResearch/hermes-agent/blob/main/README.md")
      ]
    },
    repoStats: {
      repoFullName: "NousResearch/hermes-agent",
      stars: 75776,
      forks: 10101,
      pushedAt: "2026-04-13T16:42:33Z",
      createdAt: "2025-07-22T22:22:28Z",
      homepage: "https://hermes-agent.nousresearch.com",
      license: "MIT"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "官方把它定义为 self-improving AI agent，核心心智是个人常驻 agent。",
        evidenceIds: ["hermes-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方表达的是完整 agent 产品，不是某个平台的附属功能。",
        evidenceIds: ["hermes-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "README 明确写能跑在 $5 VPS、GPU cluster 或 serverless，用户自持运行环境。",
        evidenceIds: ["hermes-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开了 gateway、cron、subagents、tools 和多终端后端。",
        evidenceIds: ["hermes-positioning"]
      },
      "official-docs": {
        passed: true,
        summary: "官方 docs 与 getting started 页面都公开可验证。",
        evidenceIds: ["hermes-docs"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方强调自持运行环境，可运行在本地、VPS 或 serverless。",
        evidenceIds: ["hermes-positioning"]
      },
      "web-or-admin-ui": {
        status: "partial",
        summary: "官方更强调 terminal interface，不是强 Web 控制台产品。",
        evidenceIds: ["hermes-positioning"]
      },
      "multi-channel": {
        status: "yes",
        summary: "README 公开列出 Telegram、Discord、Slack、WhatsApp、Signal 和 CLI。",
        evidenceIds: ["hermes-positioning"]
      },
      voice: {
        status: "partial",
        summary: "官方明确支持 voice memo transcription，但语音不是主要产品入口。",
        evidenceIds: ["hermes-positioning"]
      },
      "scheduled-automation": {
        status: "yes",
        summary: "README 直接列出 built-in cron scheduler。",
        evidenceIds: ["hermes-positioning"]
      },
      extensibility: {
        status: "yes",
        summary: "官方写明 skills 自生成与 agentskills.io open standard 兼容。",
        evidenceIds: ["hermes-positioning"]
      },
      memory: {
        status: "yes",
        summary: "README 明确强调 learning loop、会话搜索和跨 session 用户模型。",
        evidenceIds: ["hermes-positioning"]
      },
      "task-execution": {
        status: "yes",
        summary: "官方公开支持 subagents 并行与 Python / RPC 工具流水线。",
        evidenceIds: ["hermes-positioning"]
      },
      "deployment-flexibility": {
        status: "yes",
        summary: "官方列出 local、Docker、SSH、Daytona、Singularity、Modal 六种终端后端。",
        evidenceIds: ["hermes-positioning"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "官方 docs 有 getting started、Termux 与 gateway 配置说明。",
        evidenceIds: ["hermes-docs"]
      }
    }),
    evidence: [
      createEvidence(
        "hermes-positioning",
        "hermes-agent",
        "Hermes Agent README",
        "https://github.com/NousResearch/hermes-agent/blob/main/README.md",
        "官方 README 把 Hermes Agent 描述为 self-improving AI agent，公开强调 learning loop、消息渠道、cron、subagents、多后端运行和跨 session 用户模型。"
      ),
      createEvidence(
        "hermes-docs",
        "hermes-agent",
        "Hermes Agent Documentation",
        "https://hermes-agent.nousresearch.com/docs/",
        "官方文档公开了安装、Termux、gateway 和工具配置等使用路径。"
      )
    ]
  },
  {
    product: {
      id: "zeroclaw",
      name: "ZeroClaw",
      displayName: "ZeroClaw",
      category: "embedded-assistant",
      comparability: "core",
      disclosure: "third-party",
      shortDescription: "强调低资源占用、硬件外设和多渠道的 personal AI assistant。",
      positioning: "官方把 ZeroClaw 定位为运行在自己设备上的 personal AI assistant，并把 web dashboard、channels、cron、skills、memory 放进统一网关里。",
      bestFor: "适合重视边缘硬件、低成本部署和真实消息入口的用户。",
      caution: "产品形态很强，但仍带有强烈的 OpenClaw 系谱风格和工程感。",
      highlight: "超低资源占用、Web dashboard、channels、cron、skills、memory。",
      tags: ["edge", "web-dashboard", "channels", "cron", "skills"],
      sources: [
        repoSource("https://github.com/zeroclaw-labs/zeroclaw"),
        docsSource("https://github.com/zeroclaw-labs/zeroclaw/tree/master/docs"),
        siteSource("https://www.zeroclawlabs.ai/"),
        readmeSource("https://github.com/zeroclaw-labs/zeroclaw/blob/master/README.md")
      ]
    },
    repoStats: {
      repoFullName: "zeroclaw-labs/zeroclaw",
      stars: 30088,
      forks: 4328,
      pushedAt: "2026-04-13T16:28:09Z",
      createdAt: "2026-02-13T08:56:04Z",
      homepage: "https://www.zeroclawlabs.ai/",
      license: "Apache-2.0"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "README 直接把 ZeroClaw 定义为 personal AI assistant。",
        evidenceIds: ["zeroclaw-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方强调 gateway 是 control plane，产品本体是 assistant。",
        evidenceIds: ["zeroclaw-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "README 明确写 run on your own devices。",
        evidenceIds: ["zeroclaw-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开 channels、cron、SOPs、skills、tools、memory 和 web dashboard。",
        evidenceIds: ["zeroclaw-positioning", "zeroclaw-features"]
      },
      "official-docs": {
        passed: true,
        summary: "官方仓库、官网和 docs 目录都公开可访问。",
        evidenceIds: ["zeroclaw-features"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方强调运行在自己的设备上，并公开 local allowlist 与本地网关。",
        evidenceIds: ["zeroclaw-positioning"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "README 直接写 Web Dashboard，含 memory browser、cron manager、tool inspector。",
        evidenceIds: ["zeroclaw-features"]
      },
      "multi-channel": {
        status: "yes",
        summary: "官方公开列出 WhatsApp、Telegram、Slack、Discord、Signal、Email、DingTalk、Lark、QQ、WeChat Work 等大量渠道。",
        evidenceIds: ["zeroclaw-positioning", "zeroclaw-features"]
      },
      "scheduled-automation": {
        status: "yes",
        summary: "README 明确公开 cron 与 SOPs。",
        evidenceIds: ["zeroclaw-features"]
      },
      extensibility: {
        status: "yes",
        summary: "官方公开了 tools、skills、lifecycle hooks 和 swappable core systems。",
        evidenceIds: ["zeroclaw-features"]
      },
      memory: {
        status: "yes",
        summary: "官方公开了 memory browser、OpenClaw memory import 和 memory loading。",
        evidenceIds: ["zeroclaw-features"]
      },
      "task-execution": {
        status: "yes",
        summary: "官方公开 agent orchestration loop、Hands、多 agent orchestration 和 tools dispatch。",
        evidenceIds: ["zeroclaw-features"]
      },
      "deployment-flexibility": {
        status: "yes",
        summary: "官方强调单二进制、跨 ARM/x86/RISC-V，并可接硬件外设。",
        evidenceIds: ["zeroclaw-features"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "README 明确给出 onboard、one-click bootstrap 和 beginner guide。",
        evidenceIds: ["zeroclaw-positioning"]
      }
    }),
    evidence: [
      createEvidence(
        "zeroclaw-positioning",
        "zeroclaw",
        "ZeroClaw README",
        "https://github.com/zeroclaw-labs/zeroclaw/blob/master/README.md",
        "官方 README 把 ZeroClaw 定义为 personal AI assistant，强调 own devices、多渠道、web dashboard、gateway 和 onboarding。"
      ),
      createEvidence(
        "zeroclaw-features",
        "zeroclaw",
        "ZeroClaw README Feature Sections",
        "https://github.com/zeroclaw-labs/zeroclaw/blob/master/README.md",
        "官方 README 的 feature 和 quick start 部分公开列出 cron、skills、memory、web dashboard、agent orchestration、SOPs 和 hardware peripherals。"
      )
    ]
  },
  {
    product: {
      id: "picoclaw",
      name: "PicoClaw",
      displayName: "PicoClaw",
      category: "embedded-assistant",
      comparability: "core",
      disclosure: "third-party",
      shortDescription: "面向低成本硬件和跨架构部署的 ultra-lightweight AI assistant。",
      positioning: "官方把 PicoClaw 描述为 ultra-lightweight personal AI assistant，并公开 Web UI Launcher、WeChat / WeCom、MCP、memory 与 Docker Compose。",
      bestFor: "最适合想把 assistant 带到低价硬件、IoT 边缘设备或多架构环境的人。",
      caution: "产品传播非常强，但当前能力说明里大量信息来自快速迭代日志，稳定性仍需用户自行判断。",
      highlight: "低资源占用、MCP、Web UI Launcher、多渠道和多架构部署。",
      tags: ["edge", "wecom", "wechat", "mcp", "web-ui"],
      sources: [
        repoSource("https://github.com/sipeed/picoclaw"),
        docsSource("https://docs.picoclaw.io/"),
        siteSource("https://picoclaw.io"),
        readmeSource("https://github.com/sipeed/picoclaw/blob/main/README.md")
      ]
    },
    repoStats: {
      repoFullName: "sipeed/picoclaw",
      stars: 28093,
      forks: 4002,
      pushedAt: "2026-04-13T16:19:15Z",
      createdAt: "2026-02-04T12:32:35Z",
      homepage: "https://picoclaw.io",
      license: "MIT"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "README 直接称 PicoClaw 为 ultra-lightweight personal AI assistant。",
        evidenceIds: ["picoclaw-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方定位是独立 assistant，不是某个平台附属功能。",
        evidenceIds: ["picoclaw-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "官方强调在 $10 hardware、本地板卡和多架构环境运行。",
        evidenceIds: ["picoclaw-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "公开资料写明 channels、MCP、memory、providers、Gateway 与 sub-agent 状态。",
        evidenceIds: ["picoclaw-features"]
      },
      "official-docs": {
        passed: true,
        summary: "官方站、docs 和 README 都公开可核验。",
        evidenceIds: ["picoclaw-features"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方把本地硬件和边缘设备部署当作核心卖点。",
        evidenceIds: ["picoclaw-positioning"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "README 更新日志明确公开 Web UI Launcher 和 system tray UI。",
        evidenceIds: ["picoclaw-features"]
      },
      "multi-channel": {
        status: "yes",
        summary: "官方更新日志明确列出 WeChat、WeCom、Matrix、IRC、Discord Proxy 等渠道。",
        evidenceIds: ["picoclaw-features"]
      },
      "scheduled-automation": {
        status: "yes",
        summary: "官方明确写到 Cron security gating 与 channel auto-orchestration。",
        evidenceIds: ["picoclaw-features"]
      },
      extensibility: {
        status: "yes",
        summary: "README 明确公开 MCP support、capability interfaces 与 providers 扩展。",
        evidenceIds: ["picoclaw-features"]
      },
      memory: {
        status: "yes",
        summary: "官方更新日志公开了 JSONL memory store。",
        evidenceIds: ["picoclaw-features"]
      },
      "task-execution": {
        status: "yes",
        summary: "官方公开 assistant workflows、sub-agent status 与 model routing。",
        evidenceIds: ["picoclaw-features"]
      },
      "deployment-flexibility": {
        status: "yes",
        summary: "官方强调 x86_64、ARM64、MIPS、RISC-V、LoongArch 与 Docker Compose。",
        evidenceIds: ["picoclaw-positioning", "picoclaw-features"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "官方 docs、hardware compatibility 和 DeepWiki 公开可访问。",
        evidenceIds: ["picoclaw-features"]
      }
    }),
    evidence: [
      createEvidence(
        "picoclaw-positioning",
        "picoclaw",
        "PicoClaw README",
        "https://github.com/sipeed/picoclaw/blob/main/README.md",
        "官方 README 把 PicoClaw 定义为 ultra-lightweight personal AI assistant，并强调 $10 hardware、多架构支持和官方 docs。"
      ),
      createEvidence(
        "picoclaw-features",
        "picoclaw",
        "PicoClaw README Release Notes",
        "https://github.com/sipeed/picoclaw/blob/main/README.md",
        "官方 README 的更新记录公开列出了 WeChat / WeCom、system tray UI、MCP、JSONL memory、Docker Compose、Web UI Launcher 和 model routing。"
      )
    ]
  },
  {
    product: {
      id: "ironclaw",
      name: "IronClaw",
      displayName: "IronClaw",
      category: "personal-assistant",
      comparability: "core",
      disclosure: "third-party",
      shortDescription: "以本地隐私、安全沙箱和多渠道为核心的 secure personal AI assistant。",
      positioning: "官方把 IronClaw 定义为 secure personal AI assistant，强调本地数据、WASM sandbox、web gateway、cron 和 plugin architecture。",
      bestFor: "适合把隐私、安全和可审计性放在第一位的用户。",
      caution: "产品主叙事更偏 security-first，生态广度和声量仍落后于头部渠道型产品。",
      highlight: "本地加密、WASM sandbox、web gateway、cron、plugin architecture。",
      tags: ["security-first", "local-data", "web-gateway", "cron", "plugins"],
      sources: [
        repoSource("https://github.com/nearai/ironclaw"),
        siteSource("https://www.ironclaw.com"),
        readmeSource("https://github.com/nearai/ironclaw/blob/staging/README.md")
      ]
    },
    repoStats: {
      repoFullName: "nearai/ironclaw",
      stars: 11727,
      forks: 1346,
      pushedAt: "2026-04-13T15:40:27Z",
      createdAt: "2026-02-03T06:57:10Z",
      homepage: "https://www.ironclaw.com",
      license: "Apache-2.0"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "README 直接写 Your secure personal AI assistant。",
        evidenceIds: ["ironclaw-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方表达的是独立 assistant 产品，而不是某个 builder 或 chat UI。",
        evidenceIds: ["ironclaw-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "README 强调 all information is stored locally, encrypted。",
        evidenceIds: ["ironclaw-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开了 web gateway、webhooks、cron、dynamic tool building 和 channels。",
        evidenceIds: ["ironclaw-features"]
      },
      "official-docs": {
        passed: true,
        summary: "官方 README、官网与安装章节可公开核验。",
        evidenceIds: ["ironclaw-features"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方强调数据本地存储、加密且不离开用户控制边界。",
        evidenceIds: ["ironclaw-positioning"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "README 明确列出 Web Gateway。",
        evidenceIds: ["ironclaw-features"]
      },
      "multi-channel": {
        status: "yes",
        summary: "README 公开 REPL、HTTP webhooks、Telegram、Slack 和 web gateway。",
        evidenceIds: ["ironclaw-features"]
      },
      "scheduled-automation": {
        status: "yes",
        summary: "官方明确公开 Routines，包含 cron、event triggers 和 webhook handlers。",
        evidenceIds: ["ironclaw-features"]
      },
      extensibility: {
        status: "yes",
        summary: "官方公开 dynamic tool building 与 plugin architecture。",
        evidenceIds: ["ironclaw-features"]
      },
      memory: {
        status: "yes",
        summary: "README 明确写 Persistent Memory 与 identity files。",
        evidenceIds: ["ironclaw-features"]
      },
      "task-execution": {
        status: "yes",
        summary: "官方公开 sandboxed tools、container execution 和 capability-based permissions。",
        evidenceIds: ["ironclaw-features"]
      },
      "deployment-flexibility": {
        status: "yes",
        summary: "官方公开 REPL、Docker sandbox 与 web gateway 多种运行形态。",
        evidenceIds: ["ironclaw-features"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "README 自带 installation、configuration、architecture 和 security 章节。",
        evidenceIds: ["ironclaw-features"]
      }
    }),
    evidence: [
      createEvidence(
        "ironclaw-positioning",
        "ironclaw",
        "IronClaw README",
        "https://github.com/nearai/ironclaw/blob/staging/README.md",
        "官方 README 将 IronClaw 表述为 secure personal AI assistant，并强调本地加密、透明可审计和对抗数据外泄。"
      ),
      createEvidence(
        "ironclaw-features",
        "ironclaw",
        "IronClaw README Feature Sections",
        "https://github.com/nearai/ironclaw/blob/staging/README.md",
        "官方 README 的 features 部分公开列出了 web gateway、multi-channel、routines、plugin architecture、persistent memory 和 Docker sandbox。"
      )
    ]
  },
  {
    product: {
      id: "leon",
      name: "Leon",
      displayName: "Leon",
      category: "personal-assistant",
      comparability: "core",
      disclosure: "third-party",
      shortDescription: "老牌开源 personal AI assistant，当前重构成 tools + memory + agentic execution 形态。",
      positioning: "官方把 Leon 定义为 open-source personal AI assistant，并公开强调 tools、context、memory、agentic execution 与 web application。",
      bestFor: "适合重视开源传统、模块化技能体系和本地隐私边界的用户。",
      caution: "当前 develop 分支文档尚未完全跟上新架构，公开上手信息不如头部产品完整。",
      highlight: "历史沉淀长，tools / context / memory / skills 边界清晰。",
      tags: ["open-source", "memory", "skills", "web-app", "local-first"],
      sources: [
        repoSource("https://github.com/leon-ai/leon"),
        siteSource("https://getleon.ai"),
        readmeSource("https://github.com/leon-ai/leon/blob/develop/README.md")
      ]
    },
    repoStats: {
      repoFullName: "leon-ai/leon",
      stars: 17153,
      forks: 1439,
      pushedAt: "2026-04-13T14:28:39Z",
      createdAt: "2019-02-10T12:25:12Z",
      homepage: "https://getleon.ai",
      license: "MIT"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "README 明确把 Leon 定义为 open-source personal AI assistant。",
        evidenceIds: ["leon-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方表达的是独立 assistant 产品，不是某个 suite 的附属能力。",
        evidenceIds: ["leon-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "README 强调 can operate locally，并强调 privacy-aware。",
        evidenceIds: ["leon-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开了 tools、skills、toolkits、bridges、workflow execution 和 binaries。",
        evidenceIds: ["leon-features"]
      },
      "official-docs": {
        passed: true,
        summary: "虽然 develop 文档尚未完全就位，但官方 repo、site 和 roadmap 公开存在。",
        evidenceIds: ["leon-docs"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方明确写 operate locally 和 local context。",
        evidenceIds: ["leon-positioning"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "README 公开了 app/ web application 目录。",
        evidenceIds: ["leon-features"]
      },
      voice: {
        status: "partial",
        summary: "README 写到 voice / audio features，但不是当前主叙事核心。",
        evidenceIds: ["leon-features"]
      },
      extensibility: {
        status: "yes",
        summary: "官方明确写 skills、toolkits、bridges 和 binaries make Leon modular。",
        evidenceIds: ["leon-features"]
      },
      memory: {
        status: "yes",
        summary: "README 直接写 layered memory。",
        evidenceIds: ["leon-positioning"]
      },
      "task-execution": {
        status: "yes",
        summary: "官方公开说明它能 choose how to handle a goal, use tools, and complete tasks from start to finish。",
        evidenceIds: ["leon-positioning"]
      },
      "deployment-flexibility": {
        status: "partial",
        summary: "官方强调 local 与 remote AI providers，但公开部署入口主要围绕本地运行。",
        evidenceIds: ["leon-positioning"]
      },
      "docs-onboarding": {
        status: "partial",
        summary: "官方 README 明确提醒 develop 文档尚未完全就位，资料可信但仍在过渡。",
        evidenceIds: ["leon-docs"]
      }
    }),
    evidence: [
      createEvidence(
        "leon-positioning",
        "leon",
        "Leon README",
        "https://github.com/leon-ai/leon/blob/develop/README.md",
        "官方 README 把 Leon 定义为 open-source personal AI assistant，并强调 tools、context、memory、agentic execution、本地运行与隐私边界。"
      ),
      createEvidence(
        "leon-features",
        "leon",
        "Leon README Architecture Sections",
        "https://github.com/leon-ai/leon/blob/develop/README.md",
        "官方 README 公开了 app、skills、bridges、toolkits 与 voice/audio features 等当前架构组成。"
      ),
      createEvidence(
        "leon-docs",
        "leon",
        "Leon README Important Notice",
        "https://github.com/leon-ai/leon/blob/develop/README.md",
        "官方 README 明确提示 develop 分支的文档仍在追赶新架构，因此 docs-onboarding 只给部分分。"
      )
    ]
  },
  {
    product: {
      id: "sentient",
      name: "Sentient",
      displayName: "Sentient",
      category: "personal-assistant",
      comparability: "watch",
      disclosure: "third-party",
      shortDescription: "强调主动式数字生活管理和多应用连接的 personal assistant。",
      positioning: "官方把 Sentient 表述为 advanced personal assistant 和 central command center，强调主动管理日程、邮件、任务、记忆和多应用连接。",
      bestFor: "适合更看重 proactive partner、日程管理和数字生活协作的人。",
      caution: "项目成熟度、许可证清晰度和社区规模仍不在第一梯队。",
      highlight: "主动式日程管理、语音、后台任务、记忆和 20+ 应用连接。",
      tags: ["proactive", "voice", "tasks", "memory", "integrations"],
      sources: [
        repoSource("https://github.com/existence-master/Sentient"),
        docsSource("https://sentient-2.gitbook.io/docs"),
        siteSource("https://existence.technology/sentient"),
        readmeSource("https://github.com/existence-master/Sentient/blob/master/README.md")
      ]
    },
    repoStats: {
      repoFullName: "existence-master/Sentient",
      stars: 677,
      forks: 97,
      pushedAt: "2026-02-23T11:34:09Z",
      createdAt: "2025-02-20T04:33:41Z",
      homepage: "https://existence.technology/sentient",
      license: "NOASSERTION"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "官方 README 和 repo 描述都明确把它写成 personal assistant。",
        evidenceIds: ["sentient-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方直接把它说成 central command center，而不是附属功能。",
        evidenceIds: ["sentient-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "README 明确提供 fully self-hosted / fully local 的说明。",
        evidenceIds: ["sentient-self-host"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开了背景任务、日程管理、20+ apps 连接和 multi-step tasks。",
        evidenceIds: ["sentient-positioning"]
      },
      "official-docs": {
        passed: true,
        summary: "官方仓库、站点和 GitBook docs 都公开可验证。",
        evidenceIds: ["sentient-self-host"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方明确写可 self-host 并 fully locally run。",
        evidenceIds: ["sentient-self-host"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "官方 README 展示了 tasks page、voice chat 和网站入口。",
        evidenceIds: ["sentient-positioning"]
      },
      "multi-channel": {
        status: "partial",
        summary: "官方强调 20+ apps 连接，但消息渠道列表不如 OpenClaw 家族那样明确。",
        evidenceIds: ["sentient-positioning"]
      },
      voice: {
        status: "yes",
        summary: "README 明确写 text or voice。",
        evidenceIds: ["sentient-positioning"]
      },
      "scheduled-automation": {
        status: "yes",
        summary: "官方公开 recurring、triggered、scheduled、swarm tasks。",
        evidenceIds: ["sentient-positioning"]
      },
      extensibility: {
        status: "partial",
        summary: "官方强调 connect all your tools 和 20+ apps，但插件 / skills 体系公开程度一般。",
        evidenceIds: ["sentient-positioning"]
      },
      memory: {
        status: "yes",
        summary: "官方明确写 learns memories about you。",
        evidenceIds: ["sentient-positioning"]
      },
      "task-execution": {
        status: "yes",
        summary: "README 直接写 execute complex, multi-step tasks。",
        evidenceIds: ["sentient-positioning"]
      },
      "deployment-flexibility": {
        status: "partial",
        summary: "官方明确支持 self-host / local，但多环境部署表达不如 edge / cloud 型产品强。",
        evidenceIds: ["sentient-self-host"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "官方 GitBook docs 和 from source self-host 文档公开存在。",
        evidenceIds: ["sentient-self-host"]
      }
    }),
    evidence: [
      createEvidence(
        "sentient-positioning",
        "sentient",
        "Sentient README",
        "https://github.com/existence-master/Sentient/blob/master/README.md",
        "官方 README 把 Sentient 定位成 advanced personal assistant / central command center，并公开了 voice、tasks、memory、20+ apps 和 multi-step tasks。"
      ),
      createEvidence(
        "sentient-self-host",
        "sentient",
        "Sentient Self-host Docs",
        "https://sentient-2.gitbook.io/docs/getting-started/running-sentient-from-source-self-host",
        "官方文档明确提供 running from source self-host 方案，并写明可 fully locally run。"
      )
    ]
  },
  {
    product: {
      id: "opendan",
      name: "OpenDAN",
      displayName: "OpenDAN",
      category: "operating-layer",
      comparability: "watch",
      disclosure: "third-party",
      shortDescription: "把个人 AI OS 明确写进产品定位的老牌 open-source 项目。",
      positioning: "官方把 OpenDAN 定义为 open source Personal AI OS，强调多 AI modules、agents 协作、Docker、IoT 和知识库。",
      bestFor: "适合更认同 AI OS 叙事、愿意接受较长产品演进周期的用户。",
      caution: "项目年龄更长，但产品完成度与现代前沿项目相比并不一定更强。",
      highlight: "Personal AI OS 叙事直接、Docker、IoT、知识库和 agent/ workflow 组合。",
      tags: ["personal-ai-os", "docker", "iot", "knowledge-base", "agents"],
      sources: [
        repoSource("https://github.com/fiatrete/OpenDAN-Personal-AI-OS"),
        siteSource("https://opendan.ai"),
        readmeSource("https://github.com/fiatrete/OpenDAN-Personal-AI-OS/blob/main/README.md")
      ]
    },
    repoStats: {
      repoFullName: "fiatrete/OpenDAN-Personal-AI-OS",
      stars: 2015,
      forks: 215,
      pushedAt: "2026-03-28T18:09:00Z",
      createdAt: "2023-05-11T03:06:49Z",
      homepage: "https://opendan.ai",
      license: "MIT"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "官方直接把它定义为 Personal AI OS。",
        evidenceIds: ["opendan-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "官方主表达就是 AI OS / 个人 AI 入口，不是 builder 或附属功能。",
        evidenceIds: ["opendan-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "官方明确写 Docker 安装和本地开源模型支持。",
        evidenceIds: ["opendan-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开 agents、workflows、Telegram / Email、知识库与 IoT 设备控制。",
        evidenceIds: ["opendan-positioning"]
      },
      "official-docs": {
        passed: true,
        summary: "官方 repo 和站点都公开可访问。",
        evidenceIds: ["opendan-positioning"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方公开了 Docker、自建环境和本地开源模型支持。",
        evidenceIds: ["opendan-positioning"]
      },
      "scheduled-automation": {
        status: "partial",
        summary: "官方更强调 workflows 与 agents，定时自动化并非当前 README 的最强项。",
        evidenceIds: ["opendan-positioning"]
      },
      extensibility: {
        status: "yes",
        summary: "官方写明可以新增 Agent / Workflow / Models，并规划 OpenDAN Store。",
        evidenceIds: ["opendan-positioning"]
      },
      memory: {
        status: "partial",
        summary: "官方强调个人知识库和 communication records，但独立 memory 体系公开表达一般。",
        evidenceIds: ["opendan-positioning"]
      },
      "task-execution": {
        status: "yes",
        summary: "官方明确写多 agents 协作、integrate existing services、command IoT devices。",
        evidenceIds: ["opendan-positioning"]
      },
      "deployment-flexibility": {
        status: "yes",
        summary: "官方公开 PC / Mac / Raspberry Pi / NAS 的 Docker 路线。",
        evidenceIds: ["opendan-positioning"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "README 提供 QuickStart 与 installation 章节。",
        evidenceIds: ["opendan-positioning"]
      }
    }),
    evidence: [
      createEvidence(
        "opendan-positioning",
        "opendan",
        "OpenDAN README",
        "https://github.com/fiatrete/OpenDAN-Personal-AI-OS/blob/main/README.md",
        "官方 README 把 OpenDAN 定位成 Personal AI OS，并公开了 Docker、本地模型、Telegram / Email、知识库、IoT 和 Agent / Workflow 能力。"
      )
    ]
  },
  {
    product: {
      id: "zclaw",
      name: "zclaw",
      displayName: "zclaw",
      category: "embedded-assistant",
      comparability: "watch",
      disclosure: "third-party",
      shortDescription: "跑在 ESP32 上的超小型 AI personal assistant。",
      positioning: "官方把 zclaw 定义为 smallest possible AI personal assistant for ESP32，并公开 scheduled tasks、persistent memory、custom tools 和 local admin console。",
      bestFor: "适合极端看重嵌入式、本地硬件和最小资源预算的用户。",
      caution: "这是很窄但很有辨识度的子类，不适合作为所有用户的默认入口产品。",
      highlight: "ESP32、scheduled tasks、persistent memory、custom tools、local admin。",
      tags: ["esp32", "embedded", "memory", "scheduled-tasks", "local-admin"],
      sources: [
        repoSource("https://github.com/tnm/zclaw"),
        docsSource("https://zclaw.dev"),
        siteSource("https://zclaw.dev"),
        readmeSource("https://github.com/tnm/zclaw/blob/main/README.md")
      ]
    },
    repoStats: {
      repoFullName: "tnm/zclaw",
      stars: 2068,
      forks: 177,
      pushedAt: "2026-03-23T05:01:30Z",
      createdAt: "2026-02-16T19:52:01Z",
      homepage: "https://zclaw.dev",
      license: "MIT"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "README 明确写 smallest possible AI personal assistant。",
        evidenceIds: ["zclaw-positioning"]
      },
      "standalone-entry": {
        passed: true,
        summary: "虽然非常轻量，但官方仍把它作为独立 assistant 产品来表达。",
        evidenceIds: ["zclaw-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "产品天然运行在本地 ESP32 硬件上。",
        evidenceIds: ["zclaw-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开了 scheduled tasks、GPIO control、persistent memory、custom tools 和 Telegram relay。",
        evidenceIds: ["zclaw-positioning"]
      },
      "official-docs": {
        passed: true,
        summary: "官方 docs 站、local admin 页面和 use cases 页面公开存在。",
        evidenceIds: ["zclaw-docs"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方明确运行在 ESP32，并通过 provision 脚本写入本地运行时凭据。",
        evidenceIds: ["zclaw-positioning"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "官方 docs 直接提供 Local Admin Console。",
        evidenceIds: ["zclaw-docs"]
      },
      "multi-channel": {
        status: "partial",
        summary: "README 公开了 Telegram token / chat allowlist 和 web relay 验证路径，但渠道面不广。",
        evidenceIds: ["zclaw-positioning"]
      },
      "scheduled-automation": {
        status: "yes",
        summary: "README 直接写 supports scheduled tasks。",
        evidenceIds: ["zclaw-positioning"]
      },
      extensibility: {
        status: "yes",
        summary: "官方公开了 custom tool composition through natural language。",
        evidenceIds: ["zclaw-positioning"]
      },
      memory: {
        status: "yes",
        summary: "README 直接写 persistent memory。",
        evidenceIds: ["zclaw-positioning"]
      },
      "task-execution": {
        status: "yes",
        summary: "GPIO control 和 custom tools 说明它不仅是对话界面。",
        evidenceIds: ["zclaw-positioning"]
      },
      "deployment-flexibility": {
        status: "partial",
        summary: "公开路线主要是 ESP32 和本地 flash / provision，不是泛化多环境产品。",
        evidenceIds: ["zclaw-positioning"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "官方 docs 提供 getting started、local admin、use cases 和 changelog。",
        evidenceIds: ["zclaw-docs"]
      }
    }),
    evidence: [
      createEvidence(
        "zclaw-positioning",
        "zclaw",
        "zclaw README",
        "https://github.com/tnm/zclaw/blob/main/README.md",
        "官方 README 把 zclaw 定义为 smallest possible AI personal assistant for ESP32，并公开 scheduled tasks、GPIO control、persistent memory 和 custom tools。"
      ),
      createEvidence(
        "zclaw-docs",
        "zclaw",
        "zclaw Docs",
        "https://zclaw.dev",
        "官方 docs 站公开提供 local admin console、getting started、use cases 和 changelog。"
      )
    ]
  },
  {
    product: {
      id: "clawx",
      name: "ClawX",
      displayName: "ClawX",
      category: "wrapper",
      comparability: "watch",
      disclosure: "third-party",
      shortDescription: "OpenClaw agents 的桌面图形界面和包装层。",
      positioning: "官方把 ClawX 表述为 The Desktop Interface for OpenClaw AI Agents，本质是 OpenClaw 的桌面包装与体验层，而不是独立龙虾类内核。",
      bestFor: "适合不想直接面对 CLI、但又想使用 OpenClaw 能力的用户。",
      caution: "它是衍生包装层，不应和独立龙虾类产品统一排名。",
      highlight: "桌面 GUI、guided setup、多渠道管理、调度任务。",
      tags: ["desktop-gui", "openclaw-wrapper", "channels", "scheduler"],
      sources: [
        repoSource("https://github.com/ValueCell-ai/ClawX"),
        siteSource("https://claw-x.com"),
        readmeSource("https://github.com/ValueCell-ai/ClawX/blob/main/README.md")
      ]
    },
    repoStats: {
      repoFullName: "ValueCell-ai/ClawX",
      stars: 6470,
      forks: 931,
      pushedAt: "2026-04-13T13:56:17Z",
      createdAt: null,
      homepage: "https://claw-x.com",
      license: "MIT"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: false,
        summary: "官方定位是 OpenClaw agents 的桌面界面，而不是独立 personal AI assistant。",
        evidenceIds: ["clawx-positioning"]
      },
      "standalone-entry": {
        passed: false,
        summary: "它依附 OpenClaw runtime，不是独立龙虾类入口。",
        evidenceIds: ["clawx-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "ClawX 运行在本地桌面，并内嵌 OpenClaw runtime。",
        evidenceIds: ["clawx-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开了多渠道管理和调度任务，但这些能力来自底层 OpenClaw agent 系统。",
        evidenceIds: ["clawx-positioning"]
      },
      "official-docs": {
        passed: true,
        summary: "官方 repo 和站点公开存在。",
        evidenceIds: ["clawx-positioning"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "它是本地桌面应用。",
        evidenceIds: ["clawx-positioning"]
      },
      "web-or-admin-ui": {
        status: "partial",
        summary: "它提供桌面 GUI，而不是独立 Web / admin 产品。",
        evidenceIds: ["clawx-positioning"]
      },
      "multi-channel": {
        status: "yes",
        summary: "官方公开支持多渠道管理。",
        evidenceIds: ["clawx-positioning"]
      },
      "scheduled-automation": {
        status: "yes",
        summary: "官方公开支持 scheduling intelligent tasks。",
        evidenceIds: ["clawx-positioning"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "官方 README 强调 one-click installation 和 guided setup wizard。",
        evidenceIds: ["clawx-positioning"]
      }
    }),
    evidence: [
      createEvidence(
        "clawx-positioning",
        "clawx",
        "ClawX README",
        "https://github.com/ValueCell-ai/ClawX/blob/main/README.md",
        "官方 README 把 ClawX 描述成 The Desktop Interface for OpenClaw AI Agents，强调 desktop GUI、多渠道管理、guided setup 和定时任务。"
      )
    ]
  },
  {
    product: {
      id: "openlobster",
      name: "OpenLobster",
      displayName: "OpenLobster",
      category: "personal-assistant",
      comparability: "watch",
      disclosure: "third-party",
      shortDescription: "OpenClaw 的 opinionated fork，继续沿 personal AI assistant 方向推进。",
      positioning: "官方把 OpenLobster 直接表述为 Personal AI Assistant，但同时明确它是基于 OpenClaw 的 opinionated fork。",
      bestFor: "适合想看 OpenClaw 分叉路线如何在安全、记忆和多用户方向演进的人。",
      caution: "它是直接分叉，不适合和独立龙虾类产品同权重混排。",
      highlight: "fork、memory 改造、多用户、安全与更强 UI。",
      tags: ["openclaw-fork", "personal-assistant", "security", "memory", "multi-user"],
      sources: [
        repoSource("https://github.com/Neirth/OpenLobster"),
        docsSource("https://neirth.gitbook.io/openlobster"),
        readmeSource("https://github.com/Neirth/OpenLobster/blob/main/README.md")
      ]
    },
    repoStats: {
      repoFullName: "Neirth/OpenLobster",
      stars: 233,
      forks: 18,
      pushedAt: "2026-04-13T05:38:02Z",
      createdAt: null,
      homepage: "https://neirth.gitbook.io/openlobster",
      license: "GPL-3.0"
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "官方直接称它为 Personal AI Assistant。",
        evidenceIds: ["openlobster-positioning"]
      },
      "standalone-entry": {
        passed: false,
        summary: "它是 OpenClaw 的 opinionated fork，不是完全独立的新类目产品。",
        evidenceIds: ["openlobster-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "它延续 self-hosted assistant 路线，并强化本地部署边界。",
        evidenceIds: ["openlobster-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开了 memory、multi-user、MCP、channels 和 GraphQL API。",
        evidenceIds: ["openlobster-positioning"]
      },
      "official-docs": {
        passed: true,
        summary: "官方 repo 和 GitBook 文档公开存在。",
        evidenceIds: ["openlobster-positioning"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方强调 self-hosted 路线与本地 secrets / auth 边界。",
        evidenceIds: ["openlobster-positioning"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "官方强调 first-launch setup wizard 和 browser UI。",
        evidenceIds: ["openlobster-positioning"]
      },
      "multi-channel": {
        status: "yes",
        summary: "README 列出 Telegram、Discord、WhatsApp、Slack、Twilio SMS。",
        evidenceIds: ["openlobster-positioning"]
      },
      extensibility: {
        status: "yes",
        summary: "官方公开支持 MCP、marketplace、proper GraphQL API 和多后端。",
        evidenceIds: ["openlobster-positioning"]
      },
      "docs-onboarding": {
        status: "yes",
        summary: "README 与 GitBook 都公开存在。",
        evidenceIds: ["openlobster-positioning"]
      }
    }),
    evidence: [
      createEvidence(
        "openlobster-positioning",
        "openlobster",
        "OpenLobster README",
        "https://github.com/Neirth/OpenLobster/blob/main/README.md",
        "官方 README 把 OpenLobster 表述为 Personal AI Assistant，并明确说明它是 OpenClaw 的 opinionated fork，重点改造 memory、多用户、安全、MCP 与 UI。"
      )
    ]
  },
  {
    product: {
      id: "n8nclaw",
      name: "n8nClaw",
      displayName: "n8nClaw",
      category: "wrapper",
      comparability: "watch",
      disclosure: "third-party",
      shortDescription: "基于 n8n 搭出的 lightweight self-hosted AI assistant。",
      positioning: "官方把 n8nClaw 定义为 lightweight, self-hosted AI assistant，并明确说明它 inspired by OpenClaw、built entirely in n8n。",
      bestFor: "适合本身就重度依赖 n8n、想快速复制一套视觉化龙虾风 assistant 的用户。",
      caution: "它更像用 n8n 搭出的轻量实现，不适合和独立产品内核混排。",
      highlight: "n8n、visual workflow、memory、sub-agents、多渠道。",
      tags: ["n8n", "self-hosted", "visual-workflow", "memory", "sub-agents"],
      sources: [
        repoSource("https://github.com/shabbirun/n8nclaw"),
        readmeSource("https://github.com/shabbirun/n8nclaw/blob/main/README.md")
      ]
    },
    repoStats: {
      repoFullName: "shabbirun/n8nclaw",
      stars: 223,
      forks: 67,
      pushedAt: "2026-02-10T13:21:33Z",
      createdAt: null,
      homepage: null,
      license: null
    },
    inclusionChecks: buildInclusionChecks({
      "assistant-identity": {
        passed: true,
        summary: "官方 README 明确写 lightweight, self-hosted AI assistant。",
        evidenceIds: ["n8nclaw-positioning"]
      },
      "standalone-entry": {
        passed: false,
        summary: "它是基于 n8n 搭出的视觉化实现，更像组合式包装，而非独立产品内核。",
        evidenceIds: ["n8nclaw-positioning"]
      },
      "self-hosted-or-local": {
        passed: true,
        summary: "官方 README 明确写 self-hosted。",
        evidenceIds: ["n8nclaw-positioning"]
      },
      "action-layer": {
        passed: true,
        summary: "官方公开 channels、memory、task management、sub-agents 和 tools。",
        evidenceIds: ["n8nclaw-positioning"]
      },
      "official-docs": {
        passed: true,
        summary: "官方 repo 与 README 公开存在。",
        evidenceIds: ["n8nclaw-positioning"]
      }
    }),
    capabilityAssessments: buildCapabilityAssessments({
      "local-control": {
        status: "yes",
        summary: "官方 README 直接写 self-hosted。",
        evidenceIds: ["n8nclaw-positioning"]
      },
      "web-or-admin-ui": {
        status: "yes",
        summary: "它以 n8n 视觉工作流和可视化 agent 拓扑为主。",
        evidenceIds: ["n8nclaw-positioning"]
      },
      "multi-channel": {
        status: "yes",
        summary: "官方 README 明确存在 channels triggers。",
        evidenceIds: ["n8nclaw-positioning"]
      },
      memory: {
        status: "yes",
        summary: "官方 README 直接写 Postgres Chat Memory 和 User Profile。",
        evidenceIds: ["n8nclaw-positioning"]
      },
      extensibility: {
        status: "partial",
        summary: "它依赖 n8n 节点和 workflow，不是独立技能生态。",
        evidenceIds: ["n8nclaw-positioning"]
      },
      "docs-onboarding": {
        status: "partial",
        summary: "当前主要是 README 导入步骤，没有完整独立 docs 站。",
        evidenceIds: ["n8nclaw-positioning"]
      }
    }),
    evidence: [
      createEvidence(
        "n8nclaw-positioning",
        "n8nclaw",
        "n8nClaw README",
        "https://github.com/shabbirun/n8nclaw/blob/main/README.md",
        "官方 README 把 n8nClaw 定义为 lightweight, self-hosted AI assistant，并明确说明它 built entirely in n8n、inspired by OpenClaw。"
      )
    ]
  }
];
