import type {
  PortableRuntimeAcceptanceDefinition,
  PortableRuntimeAcceptanceId,
} from "@kernel/types/portable-runtime-acceptance.types.js";

/**
 * The only product-language owner for the portable-runtime acceptance
 * contract. Every surface receives this projection from the Kernel instead of
 * carrying a parallel list of PRT ids or translations.
 */
export const PORTABLE_RUNTIME_ACCEPTANCE_LOCALES = ["zh-CN", "en"] as const;

export type PortableRuntimeAcceptanceLocale =
  (typeof PORTABLE_RUNTIME_ACCEPTANCE_LOCALES)[number];

export type PortableRuntimeAcceptancePresentation = {
  title: string;
  description: string;
};

type PortableRuntimeAcceptancePresentationCatalog = Record<
  PortableRuntimeAcceptanceLocale,
  Record<string, string>
>;

function messages(entries: Record<PortableRuntimeAcceptanceId, PortableRuntimeAcceptancePresentation>): Record<string, string> {
  return Object.fromEntries(Object.entries(entries).flatMap(([id, entry]) => [
    [`portableRuntimeAcceptance.${id}.title`, entry.title],
    [`portableRuntimeAcceptance.${id}.description`, entry.description],
  ]));
}

export const PORTABLE_RUNTIME_ACCEPTANCE_PRESENTATION: PortableRuntimeAcceptancePresentationCatalog = {
  "zh-CN": messages({
    "PRT-EXEC-001": { title: "Component 执行", description: "执行 Action，并返回可理解的结果或错误。" },
    "PRT-DATA-001": { title: "数据与持久化", description: "写入、读取并隔离应用持久数据。" },
    "PRT-FILE-001": { title: "文件与目录", description: "区分应用私有数据与用户显式授权的目录。" },
    "PRT-NET-001": { title: "受控网络", description: "仅访问声明并获准的网络目标。" },
    "PRT-SECRET-001": { title: "Secret", description: "验证 Secret 的授权、轮换与撤销边界。" },
    "PRT-RES-001": { title: "常驻服务", description: "验证后台运行、停用与恢复行为。" },
    "PRT-EVENT-001": { title: "事件与定时", description: "验证游标、重试、去重与顺序。" },
    "PRT-TASK-001": { title: "长任务", description: "验证进度、取消、超时与恢复。" },
    "PRT-STREAM-001": { title: "流式调用", description: "验证背压、断连和取消。" },
    "PRT-AGENT-001": { title: "Agent 调用", description: "Agent 与 Panel 使用同一 Action 合同。" },
    "PRT-AI-001": { title: "模型与 Agent", description: "验证受授权的模型或 Agent 调用。" },
    "PRT-COMP-001": { title: "Provider 组合", description: "验证版本化 Provider 的绑定与诊断。" },
    "PRT-ENTRY-001": { title: "统一入口", description: "验证 Panel、Agent、CLI 共享调用事实。" },
    "PRT-LIFE-001": { title: "应用生命周期", description: "验证安装、启用、停用、更新和回滚。" },
    "PRT-BOUND-001": { title: "故障隔离", description: "验证单个应用故障不会拖垮宿主。" },
    "PRT-PERF-001": { title: "资源与性能", description: "验证运行时资源与性能观察数据。" },
    "PRT-DX-001": { title: "开发者闭环", description: "验证模板到构建、测试和调用的完整路径。" },
    "PRT-DIST-001": { title: "跨平台交付", description: "验证三平台产物可安装并执行。" },
    "PRT-EVID-001": { title: "验收证据", description: "验证状态、时间、环境与证据可追溯。" },
    "PRT-REF-001": { title: "真实应用", description: "验证真实应用闭合数据、授权与入口。" },
    "PRT-DOCS-001": { title: "文档一致性", description: "验证用户文档与实际能力一致。" },
    "PRT-REL-001": { title: "稳定发布", description: "验证完整证据满足稳定发布门。" },
  }),
  en: messages({
    "PRT-EXEC-001": { title: "Component execution", description: "Run an Action with a clear result or error." },
    "PRT-DATA-001": { title: "Data and persistence", description: "Write, read, and isolate persistent App data." },
    "PRT-FILE-001": { title: "Files and directories", description: "Separate private App data from explicitly granted user directories." },
    "PRT-NET-001": { title: "Controlled networking", description: "Reach only declared and granted network targets." },
    "PRT-SECRET-001": { title: "Secrets", description: "Verify Secret grant, rotation, and revocation boundaries." },
    "PRT-RES-001": { title: "Resident services", description: "Verify background operation, disablement, and recovery." },
    "PRT-EVENT-001": { title: "Events and schedules", description: "Verify cursors, retries, deduplication, and ordering." },
    "PRT-TASK-001": { title: "Long-running tasks", description: "Verify progress, cancellation, timeout, and recovery." },
    "PRT-STREAM-001": { title: "Streaming calls", description: "Verify backpressure, disconnect, and cancellation." },
    "PRT-AGENT-001": { title: "Agent invocation", description: "Verify that Agents and Panels use one Action contract." },
    "PRT-AI-001": { title: "Models and Agents", description: "Verify authorized model or Agent invocation." },
    "PRT-COMP-001": { title: "Provider composition", description: "Verify versioned Provider bindings and diagnostics." },
    "PRT-ENTRY-001": { title: "Unified entry points", description: "Verify shared invocation facts across Panel, Agent, and CLI." },
    "PRT-LIFE-001": { title: "App lifecycle", description: "Verify install, enable, disable, update, and rollback." },
    "PRT-BOUND-001": { title: "Fault isolation", description: "Verify one App failure does not take down the host." },
    "PRT-PERF-001": { title: "Resources and performance", description: "Verify runtime resource and performance observations." },
    "PRT-DX-001": { title: "Developer loop", description: "Verify the path from template to build, test, and invocation." },
    "PRT-DIST-001": { title: "Cross-platform delivery", description: "Verify installable, executable artifacts on all three platforms." },
    "PRT-EVID-001": { title: "Acceptance evidence", description: "Verify traceable status, time, environment, and evidence." },
    "PRT-REF-001": { title: "Reference App", description: "Verify a real App closes data, grants, and entry points." },
    "PRT-DOCS-001": { title: "Documentation consistency", description: "Verify user documentation matches actual capability." },
    "PRT-REL-001": { title: "Stable release", description: "Verify complete evidence satisfies the stable release gate." },
  }),
};

export function resolvePortableRuntimeAcceptanceLocale(value: unknown): PortableRuntimeAcceptanceLocale {
  return value === "en" ? "en" : "zh-CN";
}

export function presentPortableRuntimeAcceptanceDefinition(
  definition: PortableRuntimeAcceptanceDefinition,
  locale: PortableRuntimeAcceptanceLocale,
): PortableRuntimeAcceptancePresentation {
  const catalog = PORTABLE_RUNTIME_ACCEPTANCE_PRESENTATION[locale];
  const title = catalog[definition.titleKey];
  const description = catalog[definition.descriptionKey];
  if (!title || !description) {
    // A missing translation is a product defect, never a reason to manufacture
    // a fallback title and silently hide the contract gap.
    throw new Error(`PORTABLE_RUNTIME_ACCEPTANCE_PRESENTATION_MISSING:${locale}:${!title ? definition.titleKey : definition.descriptionKey}`);
  }
  return { title, description };
}
