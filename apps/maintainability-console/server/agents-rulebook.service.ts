import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  GovernanceRule,
  GovernanceRuleOwnerSummary,
  GovernanceRuleSection,
  GovernanceRuleSectionSummary,
  GovernanceRulebookOverview
} from "../shared/maintainability.types.js";

type RuleSectionConfig = {
  heading: string;
  label: string;
  section: GovernanceRuleSection;
};

const RULE_SECTIONS: RuleSectionConfig[] = [
  {
    heading: "## Rulebook",
    label: "通用规则",
    section: "rulebook"
  },
  {
    heading: "## Project Rulebook",
    label: "项目规则",
    section: "project-rulebook"
  }
];

const FIELD_LABELS = {
  constraint: "约束/适用范围",
  example: "示例",
  counterExample: "反例",
  execution: "执行方式",
  owner: "维护责任人"
} as const;

export class AgentsRulebookService {
  readonly repoRoot: string;

  constructor(repoRoot: string) {
    this.repoRoot = repoRoot;
  }

  getOverview = (): GovernanceRulebookOverview => {
    const sourcePath = "AGENTS.md";
    const agentsPath = resolve(this.repoRoot, sourcePath);
    if (!existsSync(agentsPath)) {
      return {
        sourcePath,
        totalCount: 0,
        completeCount: 0,
        sectionSummaries: [],
        ownerSummaries: [],
        rules: []
      };
    }

    const content = readFileSync(agentsPath, "utf8");
    const sectionEntries = RULE_SECTIONS.map((sectionConfig, index) =>
      this.parseSection({
        content,
        sectionConfig,
        nextHeading: RULE_SECTIONS[index + 1]?.heading ?? null
      })
    );
    const rules = sectionEntries.flatMap((entry) => entry.rules);

    return {
      sourcePath,
      totalCount: rules.length,
      completeCount: rules.filter((rule) => rule.isComplete).length,
      sectionSummaries: sectionEntries.map<GovernanceRuleSectionSummary>((entry) => ({
        section: entry.section,
        label: entry.label,
        count: entry.rules.length,
        completeCount: entry.rules.filter((rule) => rule.isComplete).length
      })),
      ownerSummaries: this.buildOwnerSummaries(rules),
      rules
    };
  };

  parseSection = ({
    content,
    sectionConfig,
    nextHeading
  }: {
    content: string;
    sectionConfig: RuleSectionConfig;
    nextHeading: string | null;
  }): {
    section: GovernanceRuleSection;
    label: string;
    rules: GovernanceRule[];
  } => {
    const sectionBody = this.extractSectionBody(content, sectionConfig.heading, nextHeading);
    const ruleMatches = Array.from(
      sectionBody.matchAll(/^- \*\*(?<name>[^*]+)\*\*：\n(?<body>(?:(?!^- \*\*|^## ).*(?:\n|$))*)/gm)
    );

    return {
      section: sectionConfig.section,
      label: sectionConfig.label,
      rules: ruleMatches.map((match) => {
        const name = this.normalizeMultilineText(match.groups?.name ?? "");
        const body = match.groups?.body ?? "";
        const constraint = this.extractField(body, FIELD_LABELS.constraint);
        const example = this.extractField(body, FIELD_LABELS.example);
        const counterExample = this.extractField(body, FIELD_LABELS.counterExample);
        const execution = this.extractField(body, FIELD_LABELS.execution);
        const owner = this.extractField(body, FIELD_LABELS.owner);
        return {
          name,
          section: sectionConfig.section,
          sectionLabel: sectionConfig.label,
          constraint,
          example,
          counterExample,
          execution,
          owner,
          isComplete: [constraint, example, counterExample, execution, owner].every((field) => field.length > 0)
        };
      })
    };
  };

  extractSectionBody = (content: string, heading: string, nextHeading: string | null): string => {
    const startIndex = content.indexOf(heading);
    if (startIndex < 0) {
      return "";
    }
    const sectionStart = startIndex + heading.length;
    const endIndex = nextHeading ? content.indexOf(nextHeading, sectionStart) : -1;
    return content.slice(sectionStart, endIndex >= 0 ? endIndex : undefined).trim();
  };

  extractField = (body: string, fieldLabel: string): string => {
    const fieldPattern = new RegExp(
      `^  - ${this.escapeRegExp(fieldLabel)}：(.*(?:\\n(?!  - [^：]+：).*)*)`,
      "m"
    );
    const fieldMatch = body.match(fieldPattern);
    return this.normalizeMultilineText(fieldMatch?.[1] ?? "");
  };

  buildOwnerSummaries = (rules: GovernanceRule[]): GovernanceRuleOwnerSummary[] => {
    const ownerEntries = new Map<string, GovernanceRuleOwnerSummary>();
    for (const rule of rules) {
      const normalizedOwner = rule.owner || "未填写";
      const existing = ownerEntries.get(normalizedOwner);
      if (existing) {
        existing.count += 1;
        if (rule.section === "project-rulebook") {
          existing.projectRuleCount += 1;
        } else {
          existing.generalRuleCount += 1;
        }
        continue;
      }

      ownerEntries.set(normalizedOwner, {
        owner: normalizedOwner,
        count: 1,
        generalRuleCount: rule.section === "rulebook" ? 1 : 0,
        projectRuleCount: rule.section === "project-rulebook" ? 1 : 0
      });
    }

    return Array.from(ownerEntries.values()).sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.owner.localeCompare(right.owner, "zh-Hans-CN");
    });
  };

  normalizeMultilineText = (value: string): string =>
    value
      .split("\n")
      .map((line) => line.trim())
      .filter((line, index, lines) => !(line.length === 0 && lines[index - 1] === ""))
      .join("\n")
      .trim();

  escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
