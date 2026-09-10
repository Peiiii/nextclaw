import type { Command } from "commander";
import {
  createLocalUiApiClient,
  type UiApiClient,
} from "@nextclaw-cli/cli/app/services/local-api/local-ui-api-client.service.js";

/** CLI discovery uses the running kernel catalog, matching UI and AI exactly. */
export function registerResourceCommands(
  program: Command,
  createClient: () => UiApiClient | null = createLocalUiApiClient,
): void {
  const resources = program
    .command("resources")
    .description("Discover NextClaw resource URIs and snapshots");
  const request = async (params: Parameters<UiApiClient["request"]>[0]) => {
    const client = createClient();
    if (!client)
      throw new Error(
        "No local NextClaw service is running. Start nextclaw first.",
      );
    console.log(JSON.stringify(await client.request(params), null, 2));
  };
  resources
    .command("list")
    .description("List resource categories or search objects (JSON)")
    .option("--type <type>", "Registered object type")
    .option("--query <text>", "Search object names and descriptions")
    .option("--limit <count>", "Result limit per category (1-50)")
    .action(
      async ({ type, query: search, limit }: { type?: string; query?: string; limit?: string }) => {
        const query = new URLSearchParams();
        if (type !== undefined) query.set("objectType", type);
        if (search !== undefined) query.set("query", search);
        if (limit !== undefined) query.set("limit", limit);
        await request({ path: `/api/system-object-references?${query}` });
      },
    );
  resources
    .command("resolve <uri>")
    .description(
      "Resolve a resource URI to an immutable asset reference (JSON)",
    )
    .action(async (uri: string) =>
      request({
        path: "/api/system-object-references/resolve",
        method: "POST",
        body: { uri },
      }),
    );
}
