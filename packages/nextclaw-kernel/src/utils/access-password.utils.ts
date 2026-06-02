import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function createAccessPasswordRecord(password: string): { passwordHash: string; passwordSalt: string } {
  const passwordSalt = randomBytes(16).toString("hex");
  return {
    passwordHash: scryptAccessPassword(password, passwordSalt),
    passwordSalt,
  };
}

export function verifyAccessPassword(password: string, expectedHash: string, salt: string): boolean {
  const actualHashBuffer = Buffer.from(scryptAccessPassword(password, salt), "hex");
  const expectedHashBuffer = Buffer.from(expectedHash, "hex");
  if (actualHashBuffer.length !== expectedHashBuffer.length) {
    return false;
  }
  return timingSafeEqual(actualHashBuffer, expectedHashBuffer);
}

function scryptAccessPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

