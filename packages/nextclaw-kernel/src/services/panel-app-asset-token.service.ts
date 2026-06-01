import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { PanelAppError } from "@kernel/types/panel-app.types.js";

const PANEL_APP_ASSET_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

export type PanelAppAssetTokenClaims = {
  panelAppId: string;
  sourceName: string;
  expiresAt: number;
  nonce: string;
};

type PanelAppAssetTokenServiceParams = {
  now?: () => number;
  secret?: Buffer;
  ttlMs?: number;
};

export class PanelAppAssetTokenService {
  private readonly now: () => number;
  private readonly secret: Buffer;
  private readonly ttlMs: number;

  constructor(params: PanelAppAssetTokenServiceParams = {}) {
    this.now = params.now ?? Date.now;
    this.secret = params.secret ?? randomBytes(32);
    this.ttlMs = params.ttlMs ?? PANEL_APP_ASSET_TOKEN_TTL_MS;
  }

  issue = (params: {
    panelAppId: string;
    sourceName: string;
  }): string => {
    const claims: PanelAppAssetTokenClaims = {
      panelAppId: params.panelAppId,
      sourceName: params.sourceName,
      expiresAt: this.now() + this.ttlMs,
      nonce: randomBytes(12).toString("base64url"),
    };
    const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  };

  verify = (token: string): PanelAppAssetTokenClaims => {
    const normalizedToken = token.trim();
    const [payload, signature, ...rest] = normalizedToken.split(".");
    if (!payload || !signature || rest.length > 0 || !this.matchesSignature(payload, signature)) {
      throw new PanelAppError(
        "PANEL_APP_ASSET_TOKEN_INVALID",
        "invalid panel app asset token",
      );
    }
    const claims = this.parseClaims(payload);
    if (claims.expiresAt <= this.now()) {
      throw new PanelAppError(
        "PANEL_APP_ASSET_TOKEN_EXPIRED",
        "panel app asset token expired",
      );
    }
    return claims;
  };

  private sign = (payload: string): string =>
    createHmac("sha256", this.secret).update(payload).digest("base64url");

  private matchesSignature = (payload: string, signature: string): boolean => {
    const expected = Buffer.from(this.sign(payload), "utf8");
    const actual = Buffer.from(signature, "utf8");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  };

  private parseClaims = (payload: string): PanelAppAssetTokenClaims => {
    try {
      const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
      if (!isPanelAppAssetTokenClaims(claims)) {
        throw new Error("invalid panel app asset token claims");
      }
      return claims;
    } catch {
      throw new PanelAppError(
        "PANEL_APP_ASSET_TOKEN_INVALID",
        "invalid panel app asset token",
      );
    }
  };
}

function isPanelAppAssetTokenClaims(value: unknown): value is PanelAppAssetTokenClaims {
  return (
    typeof value === "object" &&
    value !== null &&
    "panelAppId" in value &&
    "sourceName" in value &&
    "expiresAt" in value &&
    "nonce" in value &&
    typeof value.panelAppId === "string" &&
    typeof value.sourceName === "string" &&
    typeof value.expiresAt === "number" &&
    typeof value.nonce === "string"
  );
}
