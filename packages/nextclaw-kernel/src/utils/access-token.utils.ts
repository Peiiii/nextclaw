import { createHash, randomBytes } from "node:crypto";

export function createAccessSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAccessSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

