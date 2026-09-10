import type { Command } from "commander";
import { randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DiscussionClient } from "@nextclaw-cli/cli/app/services/discussion/discussion-client.service.js";
import { registerDiscussionListenerCommands } from "@nextclaw-cli/cli/app/commands/discussion-listener-command-registration.utils.js";

type Options = { endpoint?: string; tokenFile?: string; space?: string; before?: string; after?: string; operationId?: string; bodyFile?: string };

export function registerDiscussionCommands(program: Command): void {
  const discussion = program.command("discussion").description("Read and participate in private NextClaw discussions");
  const command = (name: string, description: string) => discussion.command(name).description(description)
    .option("--endpoint <url>", "Discussion service origin")
    .option("--token-file <path>", "Private participant token file; otherwise use DISCUSSION_PARTICIPANT_TOKEN");
  discussion.command("skill-path").description("Print the installed discussion participant skill path")
    .action(async () => console.log(await discussionParticipantSkillPath()));
  const listen = discussion.command("listen").description("Run the configured low-cost discussion listener");
  registerDiscussionListenerCommands(listen, discussionParticipantSkillPath);
  command("list", "List discussion threads")
    .option("--space <space>", "Discussion space", "direct")
    .option("--before <cursor>", "Page before an event cursor", "0")
    .action(async (options: Options) => print(await (await client(options)).list(options.space, integer(options.before, "before"))));
  command("events", "Read discussion events after a cursor")
    .option("--after <cursor>", "Event cursor", "0")
    .action(async (options: Options) => print(await (await client(options)).events(integer(options.after, "after"))));
  command("get <id>", "Read one thread and its posts")
    .action(async (id: string, options: Options) => print(await (await client(options)).get(id)));
  command("post <id>", "Post as the authenticated discussion participant")
    .requiredOption("--body-file <path>", "UTF-8 post body")
    .option("--operation-id <id>", "Stable operation ID for retry")
    .action(async (id: string, options: Options) => print(await (await client(options)).post(
      id, options.operationId ?? randomUUID(), await readFile(options.bodyFile!, "utf8"),
    )));
}

async function client(options: Options): Promise<DiscussionClient> {
  return new DiscussionClient({
    endpoint: options.endpoint ?? process.env.NEXTCLAW_DISCUSSION_ENDPOINT ?? "https://roadmap.nextclaw.io",
    token: options.tokenFile ? (await readFile(options.tokenFile, "utf8")).trim() : process.env.DISCUSSION_PARTICIPANT_TOKEN,
  });
}

export async function discussionParticipantSkillPath(): Promise<string> {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (dirname(directory) !== directory) {
    try {
      const pkg = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as { name?: string };
      if (pkg.name === "nextclaw") {
        const path = join(directory, "resources/skills/discussion-participant/SKILL.md");
        await access(path);
        return path;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    directory = dirname(directory);
  }
  throw new Error("Packaged discussion participant skill is missing.");
}

function integer(value: string | undefined, name: string): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error(`${name} must be a non-negative integer.`);
  return parsed;
}

function print(value: unknown): void { console.log(JSON.stringify(value, null, 2)); }
