import { describe, expect, it } from "vitest";
import { createTypedKey, getKeyId } from "./typed-key.types.js";

describe("typed key", () => {
  it("creates typed keys and reads ids from keys or strings", () => {
    const key = createTypedKey<{ value: string }>(" test.key ");

    expect(key.id).toBe("test.key");
    expect(getKeyId(key)).toBe("test.key");
    expect(getKeyId(" test.string ")).toBe("test.string");
  });

  it("rejects blank typed key ids", () => {
    expect(() => createTypedKey("  ")).toThrow("typed key id is required");
  });
});
