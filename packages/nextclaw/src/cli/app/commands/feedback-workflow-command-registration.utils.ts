import type { Command } from "commander";
import { access, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SupportWorkflowOperation } from "@nextclaw/shared";
import { FeedbackWorkflowClient } from "@nextclaw-cli/cli/app/services/feedback/feedback-workflow-client.service.js";

type Options = {
  endpoint?: string;
  tokenFile?: string;
  revision: string;
  runId?: string;
  operationId?: string;
  bodyFile?: string;
  evidenceFile?: string;
  status?: SupportWorkflowOperation["status"];
  kind?: SupportWorkflowOperation["kind"];
  priority?: string;
  fixedCommit?: string;
  releaseFile?: string;
};
async function client(o: Options): Promise<FeedbackWorkflowClient> {
  return new FeedbackWorkflowClient({
    endpoint:
      o.endpoint ??
      process.env.NEXTCLAW_FEEDBACK_ENDPOINT ??
      "https://roadmap.nextclaw.io",
    token: o.tokenFile
      ? (await readFile(o.tokenFile, "utf8")).trim()
      : process.env.DISCUSSION_PARTICIPANT_TOKEN,
  });
}
export async function feedbackWorkflowSkillPath(): Promise<string> {
  let directory = dirname(fileURLToPath(import.meta.url));
  while (dirname(directory) !== directory) {
    try {
      const pkg = JSON.parse(
        await readFile(join(directory, "package.json"), "utf8")
      ) as { name?: string };
      if (pkg.name === "nextclaw") {
        const path = join(
          directory,
          "resources/skills/feedback-workflow/SKILL.md"
        );
        await access(path);
        return path;
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    directory = dirname(directory);
  }
  throw new Error("Packaged feedback workflow skill is missing.");
}
export function registerFeedbackWorkflowCommands(feedback: Command): void {
  const group = feedback
    .command("workflow")
    .description(
      "Process approved feedback with a participant credential; cannot approve work"
    );
  const command = (name: string, description: string) =>
    group
      .command(name)
      .description(description)
      .option("--endpoint <url>", "Feedback service origin")
      .option(
        "--token-file <path>",
        "Private participant token file; otherwise use DISCUSSION_PARTICIPANT_TOKEN"
      );
  group
    .command("skill-path")
    .description("Print the installed feedback workflow skill path")
    .action(async () => console.log(await feedbackWorkflowSkillPath()));
  command("list", "Read the approved feedback work queue").action(async (o: Options) =>
    console.log(JSON.stringify(await (await client(o)).scan(), null, 2))
  );
  command("get <id>", "Read the current report, approval and comments").action(
    async (id: string, o: Options) =>
      console.log(JSON.stringify(await (await client(o)).get(id), null, 2))
  );
  const actions = {
    claim: "claim",
    comment: "reply",
    result: "checkpoint",
    triage: "triage",
    recover: "recover",
    "authorize-delivery": "authorize-delivery",
    publish: "publish",
  } as const;
  for (const [name, action] of Object.entries(actions)) {
    command(
      name + " <id>",
      `Perform feedback workflow ${name}; server enforces approval and current execution`
    )
      .requiredOption(
        "--revision <number>",
        "Revision returned by get or previous operation"
      )
      .option("--run-id <id>", "Current run ID; omit before claim")
      .option("--operation-id <id>", "Stable operation ID for retry")
      .option("--body-file <path>", "UTF-8 comment text")
      .option(
        "--evidence-file <path>",
        "UTF-8 verification or recovery evidence"
      )
      .option(
        "--status <status>",
        "Result: ready, needs-info or needs-decision; triage also allows resolved"
      )
      .option("--kind <kind>", "Triage kind")
      .option("--priority <number>", "Triage priority 0–3")
      .option("--fixed-commit <sha>", "Approved repair commit for delivery")
      .option(
        "--release-file <path>",
        "JSON release proof; independently verified by the platform"
      )
      .action(async (id: string, o: Options) => {
        const revision = Number(o.revision);
        if (!Number.isInteger(revision) || revision < 1)
          throw new Error("Revision must be a positive integer.");
        if (name === "comment" && !o.bodyFile)
          throw new Error("comment requires --body-file.");
        const input: Omit<
          SupportWorkflowOperation,
          "revision" | "runId" | "operationId"
        > & { operationId?: string } = {
          action,
          operationId: o.operationId,
          status: o.status,
          kind: o.kind,
          priority: o.priority === undefined ? undefined : Number(o.priority),
          authority: action === "triage" ? "analyze" : undefined,
          fixedCommit: o.fixedCommit,
          body: o.bodyFile ? await readFile(o.bodyFile, "utf8") : undefined,
          evidence: o.evidenceFile
            ? await readFile(o.evidenceFile, "utf8")
            : undefined,
          release: o.releaseFile
            ? (JSON.parse(
                await readFile(o.releaseFile, "utf8")
              ) as SupportWorkflowOperation["release"])
            : undefined,
        };
        console.log(
          JSON.stringify(
            await (
              await client(o)
            ).act({ id, revision, runId: o.runId ?? null }, input),
            null,
            2
          )
        );
      });
  }
}
