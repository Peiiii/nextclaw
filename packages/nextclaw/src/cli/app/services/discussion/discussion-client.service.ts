import type { DiscussionEventPage, DiscussionThreadPage, DiscussionThreadView } from "@nextclaw/shared";

export class DiscussionClient {
  readonly endpoint: string;
  private readonly token: string;

  constructor({ endpoint, token }: { endpoint: string; token: string | undefined }) {
    const url = new URL(endpoint);
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("Invalid discussion origin.");
    }
    if (!token || token.length < 32) throw new Error("DISCUSSION_PARTICIPANT_TOKEN must be configured.");
    this.endpoint = url.origin;
    this.token = token;
  }

  list = (space = "direct", before = 0): Promise<DiscussionThreadPage> =>
    this.request(`?space=${encodeURIComponent(space)}&before=${before}`);

  get = (id: string): Promise<DiscussionThreadView> =>
    this.request("/" + encodeURIComponent(id));

  events = (after = 0): Promise<DiscussionEventPage> =>
    this.request("/events?after=" + after);

  post = (id: string, operationId: string, body: string): Promise<DiscussionThreadView> =>
    this.request("/" + encodeURIComponent(id) + "/posts", { operationId, body });

  private request = async <T>(path: string, body?: unknown): Promise<T> => {
    const response = await fetch(this.endpoint + "/api/discussions/participant" + path, {
      method: body === undefined ? "GET" : "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
      headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const result = await response.json() as { ok: boolean; data: T; error?: { message: string } };
    if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "Discussion request failed.");
    return result.data;
  };
}
