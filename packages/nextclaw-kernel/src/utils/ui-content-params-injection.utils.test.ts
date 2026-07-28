import { createContext, runInContext } from "node:vm";
import { describe, expect, it } from "vitest";
import {
  UI_CONTENT_PARAMS_HOST_CONTRACT,
  createUiContentParamsWindowName,
} from "@nextclaw/shared";
import {
  getUiContentParamsBootstrapScript,
  injectUiContentParamsBootstrap,
} from "@kernel/utils/ui-content-params-injection.utils.js";

describe("UI content params bootstrap", () => {
  it("exposes immutable params synchronously and preserves existing capabilities", () => {
    const openFile = () => undefined;
    const windowLike = {
      name: createUiContentParamsWindowName({
        file: { path: "/tmp/photo.png" },
        tools: ["crop", "rotate"],
      }),
      nextclaw: { openFile },
    };

    runInContext(
      getUiContentParamsBootstrapScript(),
      createContext({ window: windowLike }),
    );

    expect(windowLike.name).toBe("");
    expect(windowLike.nextclaw).toMatchObject({
      openFile,
      params: {
        file: { path: "/tmp/photo.png" },
        tools: ["crop", "rotate"],
      },
    });
    expect(Object.isFrozen(windowLike.nextclaw.params)).toBe(true);
    expect(Object.isFrozen(windowLike.nextclaw.params.file)).toBe(true);
    expect(Object.isFrozen(windowLike.nextclaw.params.tools)).toBe(true);
  });

  it("ignores unrelated window names", () => {
    const windowLike: { name: string; nextclaw?: unknown } = {
      name: "ordinary-frame-name",
    };

    runInContext(
      getUiContentParamsBootstrapScript(),
      createContext({ window: windowLike }),
    );

    expect(windowLike).toEqual({ name: "ordinary-frame-name" });
  });

  it("injects before author scripts and remains idempotent", () => {
    const html = "<!doctype html><html><head><script>window.author = true;</script></head></html>";
    const injected = injectUiContentParamsBootstrap(html);

    expect(injected).toContain("nextclaw:content-params:bootstrap");
    expect(injected.indexOf(UI_CONTENT_PARAMS_HOST_CONTRACT.windowNamePrefix)).toBeLessThan(
      injected.indexOf("window.author = true"),
    );
    expect(injectUiContentParamsBootstrap(injected)).toBe(injected);
  });
});
