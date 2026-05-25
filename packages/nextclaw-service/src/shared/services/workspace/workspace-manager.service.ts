import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_NAME, DEFAULT_SKILLS_DIR } from "@nextclaw/core";

export class WorkspaceManager {
  private readonly pkgRoot = resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "..",
    "..",
    "..",
    "..",
    ".."
  );

  readonly createWorkspaceTemplates = (workspace: string, options: { force?: boolean } = {}): { created: string[] } => {
    const created: string[] = [];
    const force = Boolean(options.force);
    const templateDir = this.resolveTemplateDir();
    if (!templateDir) {
      console.warn("Warning: Template directory not found. Skipping workspace templates.");
    }
    const templateFiles = [
      { source: "AGENTS.md", target: "AGENTS.md" },
      { source: "SOUL.md", target: "SOUL.md" },
      { source: "USER.md", target: "USER.md" },
      { source: "IDENTITY.md", target: "IDENTITY.md" },
      { source: "TOOLS.md", target: "TOOLS.md" },
      { source: "BOOT.md", target: "BOOT.md" },
      { source: "BOOTSTRAP.md", target: "BOOTSTRAP.md" },
      { source: "MEMORY.md", target: "MEMORY.md" },
      { source: "memory/MEMORY.md", target: "memory/MEMORY.md" }
    ];

    if (templateDir) {
      for (const entry of templateFiles) {
        const filePath = join(workspace, entry.target);
        if (!force && existsSync(filePath)) {
          continue;
        }
        const templatePath = join(templateDir, entry.source);
        if (!existsSync(templatePath)) {
          console.warn(`Warning: Template file missing: ${templatePath}`);
          continue;
        }
        const raw = readFileSync(templatePath, "utf-8");
        const content = raw.replace(/\$\{APP_NAME\}/g, APP_NAME);
        mkdirSync(dirname(filePath), { recursive: true });
        writeFileSync(filePath, content);
        created.push(entry.target);
      }
    }

    const memoryDir = join(workspace, "memory");
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
      created.push(join("memory", ""));
    }

    const skillsDir = join(workspace, DEFAULT_SKILLS_DIR);
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
      created.push(join(DEFAULT_SKILLS_DIR, ""));
    }
    return { created };
  };

  private readonly resolveTemplateDir = (): string | null => {
    const override = process.env.NEXTCLAW_TEMPLATE_DIR?.trim();
    if (override) {
      return override;
    }
    const candidates = [join(this.pkgRoot, "templates")];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  };

}
