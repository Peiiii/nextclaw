import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopNodeReplService } from "./desktop-node-repl.service.js";

const caller = { agentId: "agent-a", sessionId: "session-a", agentRunId: "run-a" };

function fixture() {
  const snapshot = vi.fn(async () => ({ stateId: "state-a", accessibility: { text: "[0] role=window" } }));
  const setValue = vi.fn(async () => ({ ok: true }));
  const click = vi.fn(async () => ({ ok: true }));
  const pressKey = vi.fn(async () => ({ ok: true }));
  return { snapshot, setValue, click, pressKey, service: new DesktopNodeReplService({ snapshot, setValue, click, pressKey } as never) };
}

describe("DesktopNodeReplService", () => {
  const services: DesktopNodeReplService[] = [];
  afterEach(() => services.splice(0).forEach((service) => service.dispose()));

  it("exposes only the desktop SDK and session output", async () => {
    const subject = fixture();
    services.push(subject.service);
    const result = await subject.service.execute({
      ...caller,
      code: "const state = await desktop.getAppState({ target: { applicationId: 'wechat' } }); repl.state.id = state.stateId; repl.write(typeof process); return repl.state.id;",
    });
    expect(result).toEqual({ outputs: ["undefined"], value: "state-a" });
    expect(subject.snapshot).toHaveBeenCalledWith(caller, { target: { applicationId: "wechat" } });
  });

  it("keeps repl.state for a session without sharing it across sessions", async () => {
    const subject = fixture();
    services.push(subject.service);
    await subject.service.execute({ ...caller, code: "repl.state.marker = 'kept';" });
    await expect(subject.service.execute({ ...caller, code: "return repl.state.marker;" })).resolves.toEqual({ outputs: [], value: "kept" });
    await expect(subject.service.execute({ ...caller, sessionId: "session-b", code: "return repl.state.marker;" })).resolves.toEqual({ outputs: [], value: undefined });
  });

  it("routes state-checked desktop actions through the SDK owner", async () => {
    const subject = fixture();
    services.push(subject.service);
    await subject.service.execute({
      ...caller,
      code: "await desktop.setValue({ target: { applicationId: 'wechat' }, stateId: 'state-a', element: { index: 1 }, value: 'hello' }); await desktop.click({ target: { applicationId: 'wechat' }, stateId: 'state-b', element: { index: 2 } });",
    });
    expect(subject.setValue).toHaveBeenCalledWith(caller, { target: { applicationId: "wechat" }, stateId: "state-a", elementIndex: 1, value: "hello" });
    expect(subject.click).toHaveBeenCalledWith(caller, { target: { applicationId: "wechat" }, stateId: "state-b", elementIndex: 2 });
  });

  it("permits an empty setValue so an authorized draft can be cleared", async () => {
    const subject = fixture();
    services.push(subject.service);
    await subject.service.execute({
      ...caller,
      code: "await desktop.setValue({ target: { applicationId: 'textedit' }, stateId: 'state-a', element: { index: 3 }, value: '' });",
    });
    expect(subject.setValue).toHaveBeenCalledWith(caller, {
      target: { applicationId: "textedit" }, stateId: "state-a", elementIndex: 3, value: "",
    });
  });

  it("routes screenshot-backed coordinate clicks without exposing other input APIs", async () => {
    const subject = fixture();
    services.push(subject.service);
    await subject.service.execute({
      ...caller,
      code: "await desktop.click({ target: { applicationId: 'wechat' }, stateId: 'screen-a', coordinate: { x: 100, y: 200 } });",
    });
    expect(subject.click).toHaveBeenCalledWith(caller, {
      target: { applicationId: "wechat" }, stateId: "screen-a", coordinate: { x: 100, y: 200 },
    });
  });

  it("routes a bounded keyboard chord through the Desktop SDK owner", async () => {
    const subject = fixture();
    services.push(subject.service);
    await subject.service.execute({
      ...caller,
      code: "await desktop.pressKey({ target: { applicationId: 'wechat' }, stateId: 'screen-a', key: 'f', modifiers: ['command'] });",
    });
    expect(subject.pressKey).toHaveBeenCalledWith(caller, {
      target: { applicationId: "wechat" }, stateId: "screen-a", key: "f", modifiers: ["command"],
    });
  });

  it("rejects filesystem-style Node APIs and unsupported desktop methods", async () => {
    const subject = fixture();
    services.push(subject.service);
    await expect(subject.service.execute({ ...caller, code: "require('node:fs')" })).rejects.toMatchObject({ code: "repl_execution_failed" });
    await expect(subject.service.execute({ ...caller, code: "await desktop.pressKey({ target: { applicationId: 'wechat' }, stateId: 's', key: 'F13' })" })).rejects.toMatchObject({ code: "invalid_tool_arguments" });
  });
});
