import { describe, expect, it } from "vitest";
import { buildServerPathContentUrl } from "@/shared/lib/api/utils/server-path.utils";

describe("buildServerPathContentUrl", () => {
  it("uses the query content route for absolute files", () => {
    expect(buildServerPathContentUrl("/tmp/logo.svg")).toContain(
      "/api/server-paths/content?path=%2Ftmp%2Flogo.svg",
    );
  });

  it("uses the same query content route for Windows files", () => {
    expect(buildServerPathContentUrl("C:\\Users\\me\\logo.svg")).toContain(
      "path=C%3A%5CUsers%5Cme%5Clogo.svg",
    );
  });

  it("builds a base-path content URL for relative Markdown images", () => {
    const url = buildServerPathContentUrl("assets/logo.svg", "/tmp/project");

    expect(url).toContain("/api/server-paths/content?");
    expect(url).toContain("path=assets%2Flogo.svg");
    expect(url).toContain("basePath=%2Ftmp%2Fproject");
  });

  it("rejects relative content paths when no base path is available", () => {
    expect(buildServerPathContentUrl("assets/logo.svg", null)).toBeNull();
  });
});
