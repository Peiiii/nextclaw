import { describe, expect, it } from "vitest";
import {
  decryptLocal,
  encryptLocal,
  randomSalt,
} from "./local-crypto.utils.js";

describe("local crypto utils", () => {
  it("round-trips plaintext with a passphrase", async () => {
    const payload = await encryptLocal("correct horse battery staple", "机密内容 13812345678");
    expect(payload).toContain(":");
    const decrypted = await decryptLocal("correct horse battery staple", payload);
    expect(decrypted).toBe("机密内容 13812345678");
  });

  it("produces different ciphertexts for the same input (random IV + salt)", async () => {
    const first = await encryptLocal("same-pass", "same text");
    const second = await encryptLocal("same-pass", "same text");
    expect(first).not.toBe(second);
  });

  it("rejects a wrong passphrase", async () => {
    const payload = await encryptLocal("right-pass", "secret");
    await expect(decryptLocal("wrong-pass", payload)).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const payload = await encryptLocal("pass", "secret");
    const tampered = payload.replace(/^[A-Za-z0-9+/]+/, (match) =>
      match.length > 4 ? match.slice(0, -4) + "AAAA" : match,
    );
    await expect(decryptLocal("pass", tampered)).rejects.toThrow();
  });

  it("generates a salt of the expected length", () => {
    const salt = randomSalt();
    expect(salt.byteLength).toBe(16);
  });
});
