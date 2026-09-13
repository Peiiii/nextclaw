import { createHash, generateKeyPairSync, sign, verify } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
  Actor,
  AgentIdentity,
  TrustedAgent,
  Connection,
} from "../types/collaboration.types.js";

type Envelope = {
  agentId: string;
  operationId: string;
  source: string;
  subject: string;
  purpose: "reply" | "status";
  hop: number;
  digest: string;
};
const marker =
  /\n<!-- nextclaw-collaboration:([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+) -->$/;
export const digest = (text: string): string =>
  createHash("sha256").update(text).digest("hex");
export function createIdentity(directory: string, id: string): AgentIdentity {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id))
    throw new Error(
      "Agent ID must be 1–80 letters, digits, hyphens or underscores",
    );
  const pair = generateKeyPairSync("ed25519");
  const privateKeyFile = join(directory, `${id}.pem`);
  writeFileSync(
    privateKeyFile,
    pair.privateKey.export({ type: "pkcs8", format: "pem" }),
    { mode: 0o600, flag: "wx" },
  );
  return {
    id,
    privateKeyFile,
    publicKey: pair.publicKey
      .export({ type: "spki", format: "pem" })
      .toString(),
  };
}
export function signMessage(
  identity: AgentIdentity,
  body: string,
  scope: Omit<Envelope, "agentId" | "digest">,
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...scope, agentId: identity.id, digest: digest(body) }),
  ).toString("base64url");
  const signature = sign(
    null,
    Buffer.from(payload),
    readFileSync(identity.privateKeyFile),
  ).toString("base64url");
  return `${body}\n<!-- nextclaw-collaboration:${payload}.${signature} -->`;
}
export function identifyMessage(
  body: string,
  account: string,
  source: string,
  subject: string,
  trusted: TrustedAgent[],
): Actor {
  const match = marker.exec(body);
  if (!match)
    return {
      account,
      ...(/\n<!-- nextclaw-collaboration:.* -->$/.test(body) ||
      body.startsWith("🤖[墨爪]")
        ? { invalidAgent: true }
        : {}),
    };
  try {
    const value = JSON.parse(
      Buffer.from(match[1], "base64url").toString(),
    ) as Envelope;
    const peer = trusted.find(
      (item) => item.id === value.agentId && item.account === account,
    );
    if (
      !peer ||
      value.source !== source ||
      value.subject !== subject ||
      value.digest !== digest(body.slice(0, match.index)) ||
      !Number.isSafeInteger(value.hop) ||
      value.hop < 0 ||
      !["reply", "status"].includes(value.purpose) ||
      !verify(
        null,
        Buffer.from(match[1]),
        peer.publicKey,
        Buffer.from(match[2], "base64url"),
      )
    )
      return { account, invalidAgent: true };
    return {
      account,
      agentId: value.agentId,
      hop: value.hop,
      purpose: value.purpose,
      operationId: value.operationId,
    };
  } catch {
    return { account, invalidAgent: true };
  }
}
export function stripEnvelope(body: string): string {
  return body.replace(marker, "");
}
export function containsOperation(body: string, id: string): boolean {
  const match = marker.exec(body);
  if (!match) return false;
  try {
    return (
      JSON.parse(Buffer.from(match[1], "base64url").toString()).operationId ===
      id
    );
  } catch {
    return false;
  }
}

export function isOwnOperation(
  connection: Connection,
  subject: string,
  body: string,
  account: string,
  id: string,
): boolean {
  const actor = identifyMessage(body, account, connection.source, subject, [
    { ...connection.agent, account: connection.account },
  ]);
  return actor.agentId === connection.agent.id && actor.operationId === id;
}
