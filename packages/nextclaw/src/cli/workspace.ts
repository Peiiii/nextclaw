import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { APP_NAME, getDataDir } from "@nextclaw/core";
import { which } from "./utils.js";
import { spawnSync } from "node:child_process";

export class WorkspaceManager {
  constructor(private logo: string) {}

  createWorkspaceTemplates(workspace: string, options: { force?: boolean } = {}): { created: string[] } {
    const created: string[] = [];
    const force = Boolean(options.force);
    const templateDir = this.resolveTemplateDir();
    if (!templateDir) {
      console.warn("Warning: Template directory not found. Skipping workspace templates.");
      return { created };
    }
    const templateFiles = [
      { source: "AGENTS.md", target: "AGENTS.md" },
      { source: "SOUL.md", target: "SOUL.md" },
      { source: "USER.md", target: "USER.md" },
      { source: "IDENTITY.md", target: "IDENTITY.md" },
      { source: "TOOLS.md", target: "TOOLS.md" },
      { source: "USAGE.md", target: "USAGE.md" },
      { source: "BOOT.md", target: "BOOT.md" },
      { source: "BOOTSTRAP.md", target: "BOOTSTRAP.md" },
      { source: "HEARTBEAT.md", target: "HEARTBEAT.md" },
      { source: "MEMORY.md", target: "MEMORY.md" },
      { source: "memory/MEMORY.md", target: "memory/MEMORY.md" }
    ];

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

    const memoryDir = join(workspace, "memory");
    if (!existsSync(memoryDir)) {
      mkdirSync(memoryDir, { recursive: true });
      created.push(join("memory", ""));
    }

    const skillsDir = join(workspace, "skills");
    if (!existsSync(skillsDir)) {
      mkdirSync(skillsDir, { recursive: true });
      created.push(join("skills", ""));
    }
    return { created };
  }

  private resolveTemplateDir(): string | null {
    const override = process.env.NEXTCLAW_TEMPLATE_DIR?.trim();
    if (override) {
      return override;
    }
    const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
    const pkgRoot = resolve(cliDir, "..", "..");
    const candidates = [join(pkgRoot, "templates")];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  getBridgeDir(): string {
    const userBridge = join(getDataDir(), "bridge");
    if (existsSync(join(userBridge, "dist", "index.js"))) {
      return userBridge;
    }

    if (!which("npm")) {
      console.error("npm not found. Please install Node.js >= 18.");
      process.exit(1);
    }

    const cliDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
    const pkgRoot = resolve(cliDir, "..", "..");
    const pkgBridge = join(pkgRoot, "bridge");
    const srcBridge = join(pkgRoot, "..", "..", "bridge");

    let source: string | null = null;
    if (existsSync(join(pkgBridge, "package.json"))) {
      source = pkgBridge;
    } else if (existsSync(join(srcBridge, "package.json"))) {
      source = srcBridge;
    }

    if (!source) {
      console.error(`Bridge source not found. Try reinstalling ${APP_NAME}.`);
      process.exit(1);
    }

    console.log(`${this.logo} Setting up bridge...`);
    mkdirSync(resolve(userBridge, ".."), { recursive: true });
    if (existsSync(userBridge)) {
      rmSync(userBridge, { recursive: true, force: true });
    }
    cpSync(source, userBridge, {
      recursive: true,
      filter: (src) => !src.includes("node_modules") && !src.includes("dist")
    });

    const install = spawnSync("npm", ["install"], { cwd: userBridge, stdio: "pipe" });
    if (install.status !== 0) {
      console.error(`Bridge install failed: ${install.status ?? 1}`);
      if (install.stderr) {
        console.error(String(install.stderr).slice(0, 500));
      }
      process.exit(1);
    }

    const build = spawnSync("npm", ["run", "build"], { cwd: userBridge, stdio: "pipe" });
    if (build.status !== 0) {
      console.error(`Bridge build failed: ${build.status ?? 1}`);
      if (build.stderr) {
        console.error(String(build.stderr).slice(0, 500));
      }
      process.exit(1);
    }

    console.log("✓ Bridge ready\n");
    return userBridge;
  }
}
