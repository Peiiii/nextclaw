import { WorkerEntrypoint } from "cloudflare:workers";
import type { Env } from "@/types/platform";
import { EmailDeliveryError, sendTransactionalEmail, type TransactionalEmail as Email } from "@/utils/transactional-email.utils";

/** Explicit Service Binding capability; no public HTTP endpoint dispatches this RPC. */
export class TransactionalEmail extends WorkerEntrypoint<Env> {
  override async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/send") return new Response("Not found", { status: 404 });
    if (Number(request.headers.get("content-length")) > 100_000) return new Response("Too large", { status: 413 });
    try {
      const text = await request.text();
      if (text.length > 100_000) return new Response("Too large", { status: 413 });
      let input: Email;
      try { input = JSON.parse(text) as Email; }
      catch { return new Response("Invalid email", { status: 400 }); }
      await sendTransactionalEmail(this.env, input);
      return Response.json({ sent: true });
    } catch (error) {
      return Response.json({ error: error instanceof EmailDeliveryError ? error.code : "EMAIL_DELIVERY_FAILED" }, { status: error instanceof EmailDeliveryError ? error.status : 503 });
    }
  }
}
