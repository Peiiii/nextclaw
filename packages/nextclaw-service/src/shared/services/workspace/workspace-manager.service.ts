import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_NAME, DEFAULT_PANELS_DIR, DEFAULT_SKILLS_DIR } from "@nextclaw/core";

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

    this.ensureWorkspaceDir(workspace, "memory", created);
    this.ensureWorkspaceDir(workspace, DEFAULT_SKILLS_DIR, created);
    this.ensureWorkspaceDir(workspace, DEFAULT_PANELS_DIR, created);
    return { created };
  };

  private readonly ensureWorkspaceDir = (
    workspace: string,
    dirName: string,
    created: string[],
  ): void => {
    const dir = join(workspace, dirName);
    if (existsSync(dir)) {
      return;
    }
    mkdirSync(dir, { recursive: true });
    created.push(join(dirName, ""));
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
