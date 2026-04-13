#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { resolveRepoPath } from "../shared/repo-paths.mjs";

const ROOT = resolveRepoPath(import.meta.url);

export const HOTSPOT_LOG_SECTION_TITLE = "## 红区触达与减债记录";
export const HOTSPOT_LOG_REQUIRED_FIELDS = ["本次是否减债", "说明", "下一步拆分缝"];

export const MAINTAINABILITY_HOTSPOTS = [
  {
    chain: "core-runtime",
    path: "packages/nextclaw-core/src/agent/loop.ts",
    rationale: "主循环同时承担 session 驱动、tool orchestration、事件分发与响应收尾。",
    allowedAdditions: ["主循环既有阶段内的 bug fix", "拆分为独立阶段模块所需的最小接线代码"],
    prohibitedAdditions: ["新增 prompt 组装职责", "新增 tool 策略分支", "新增持久化/事件副作用编排"],
    nextSplitSeam: "先拆 session lookup、tool loop orchestration、response finalization 三段。"
  },
  {
    chain: "cli-service-runtime",
    path: "packages/nextclaw/src/cli/commands/diagnostics.ts",
    rationale: "诊断入口已同时承担状态采集、健康检查、格式化输出与错误整理。",
    allowedAdditions: ["诊断结果字段级修正", "向独立采集器/渲染器迁移时的桥接代码"],
    prohibitedAdditions: ["新增运行时探测流程编排", "新增用户输出格式分支", "新增服务生命周期控制逻辑"],
    nextSplitSeam: "先拆 diagnostics collector、runtime status mapper、user-facing renderer。"
  },
  {
    chain: "server-ui-backend",
    path: "packages/nextclaw-server/src/ui/router/chat.controller.ts",
    rationale: "controller 已混入 request normalization、业务决策、stream 组装与错误转换。",
    allowedAdditions: ["路由协议层修复", "向 action executor / view builder 下沉逻辑时的最小适配"],
    prohibitedAdditions: ["新增业务编排", "新增配置 patch 决策", "新增 SSE 流状态管理"],
    nextSplitSeam: "先拆 request normalization、action executor、response view builder。"
  },
  {
    chain: "server-ui-backend",
    path: "packages/nextclaw-server/src/ui/config.ts",
    rationale: "配置入口已成为多页面配置聚合与运行逻辑混杂的总对象。",
    allowedAdditions: ["配置结构修正", "向按页面/按域拆分配置模块时的最小导出适配"],
    prohibitedAdditions: ["新增页面业务逻辑", "新增运行时副作用", "继续堆积跨页面配置拼装"],
    nextSplitSeam: "先按 chat/session/provider 三个域拆分配置构建与默认值归一化。"
  },
  {
    chain: "channel-runtime",
    path: "packages/extensions/nextclaw-channel-runtime/src/channels/discord.ts",
    rationale: "渠道文件同时处理 inbound normalize、policy gating、stream flush 与平台发送细节。",
    allowedAdditions: ["平台 API 兼容修复", "向共享 sender/normalizer 下沉逻辑时的最小接线"],
    prohibitedAdditions: ["新增独立 streaming 策略", "新增消息归一化分支", "复制其它渠道已有 flush/send 逻辑"],
    nextSplitSeam: "先拆 incoming normalization、draft chunking、platform send/edit adapter。"
  },
  {
    chain: "channel-runtime",
    path: "packages/extensions/nextclaw-channel-runtime/src/channels/telegram.ts",
    rationale: "Telegram 渠道已同时承载 flush orchestration、incoming handling 与平台适配。",
    allowedAdditions: ["平台兼容修复", "向共享 stream flush / attachment adapter 下沉时的最小桥接"],
    prohibitedAdditions: ["新增长流程 branching", "新增 incoming policy 编排", "新增重复的 platform send/edit 逻辑"],
    nextSplitSeam: "先拆 flush coordinator、incoming normalizer、platform send/edit abstraction。"
  },
  {
    chain: "channel-runtime",
    path: "packages/extensions/nextclaw-channel-runtime/src/channels/mochat.ts",
    rationale: "Mochat 渠道持续堆积 inbound event 处理、附件解析与发送策略。",
    allowedAdditions: ["平台协议修复", "向共享 inbound/attachment 模块迁移时的接线"],
    prohibitedAdditions: ["新增事件编排阶段", "新增独立发送策略", "继续复制渠道通用逻辑"],
    nextSplitSeam: "先拆 inbound event normalization、attachment resolve、delivery adapter。"
  },
  {
    chain: "ui-config-forms",
    path: "packages/nextclaw-ui/src/components/config/ProviderForm.tsx",
    rationale: "单个表单容器长期持有 state、auth flow、normalization 与 mutation orchestration。",
    allowedAdditions: ["字段级 UI 修复", "向 hook/section/adapter 下沉逻辑时的最小拼接"],
    prohibitedAdditions: ["新增 auth polling 流程", "新增 submit normalization 分支", "新增跨 section 状态编排"],
    nextSplitSeam: "先拆 form state hook、auth flow hook、field sections、submit adapter。"
  }
];

export function normalizeRepoPath(pathText) {
  return `${pathText ?? ""}`.trim().split(path.sep).join(path.posix.sep);
}

export function findMaintainabilityHotspot(pathText) {
  const normalized = normalizeRepoPath(pathText);
  return MAINTAINABILITY_HOTSPOTS.find((entry) => entry.path === normalized) ?? null;
}

export function listTouchedMaintainabilityHotspots(paths) {
  const deduped = new Map();
  for (const rawPath of paths) {
    const hotspot = findMaintainabilityHotspot(rawPath);
    if (hotspot) {
      deduped.set(hotspot.path, hotspot);
    }
  }
  return [...deduped.values()];
}

export function createHotspotLogHeading(hotspotPath) {
  return `### ${normalizeRepoPath(hotspotPath)}`;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function inspectHotspotLogBlock(readmeText, hotspotPath) {
  const heading = createHotspotLogHeading(hotspotPath);
  const lines = readmeText.split(/\r?\n/);
  const headingLineIndex = lines.findIndex((line) => line.trim() === heading);

  if (headingLineIndex === -1) {
    return {
      heading,
      found: false,
      missingFields: [...HOTSPOT_LOG_REQUIRED_FIELDS]
    };
  }

  const blockLines = [];
  for (let index = headingLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^##\s/.test(line) || /^###\s/.test(line)) {
      break;
    }
    blockLines.push(line);
  }

  const blockText = blockLines.join("\n");
  const missingFields = HOTSPOT_LOG_REQUIRED_FIELDS.filter(
    (field) => !new RegExp(`^-\\s*${escapeRegExp(field)}\\s*[:：]`, "m").test(blockText)
  );

  return {
    heading,
    found: true,
    missingFields
  };
}

function countLines(filePath) {
  const absolutePath = path.resolve(ROOT, filePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }
  return fs.readFileSync(absolutePath, "utf8").split(/\r?\n/).length;
}

function parseArgs(argv) {
  const args = {
    json: false,
    paths: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--paths") {
      for (let cursor = index + 1; cursor < argv.length; cursor += 1) {
        const value = argv[cursor];
        if (value.startsWith("--")) {
          break;
        }
        args.paths.push(value);
        index = cursor;
      }
    }
  }

  return args;
}

function buildCliReport(args) {
  const selectedHotspots = args.paths.length > 0
    ? listTouchedMaintainabilityHotspots(args.paths)
    : MAINTAINABILITY_HOTSPOTS;

  return selectedHotspots.map((hotspot) => ({
    ...hotspot,
    logHeading: createHotspotLogHeading(hotspot.path),
    currentLines: countLines(hotspot.path),
    exists: countLines(hotspot.path) != null
  }));
}

function printHuman(report) {
  console.log("Maintainability hotspots");
  console.log(`Tracked hotspots: ${report.length}`);

  for (const hotspot of report) {
    console.log("");
    console.log(`[${hotspot.chain}] ${hotspot.path}`);
    console.log(`- current lines: ${hotspot.currentLines == null ? "missing" : hotspot.currentLines}`);
    console.log(`- rationale: ${hotspot.rationale}`);
    console.log(`- allowed additions: ${hotspot.allowedAdditions.join(" / ")}`);
    console.log(`- prohibited additions: ${hotspot.prohibitedAdditions.join(" / ")}`);
    console.log(`- required log heading: ${hotspot.logHeading}`);
    console.log(`- next split seam: ${hotspot.nextSplitSeam}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildCliReport(args);

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHuman(report);
  }

  if (report.some((entry) => !entry.exists)) {
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
