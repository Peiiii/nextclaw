async function openAgentRuntimePicker(page, language) {
  await page.waitForSelector('textarea, [contenteditable="true"]', {
    timeout: 20_000,
  });

  const agentPickerLabel = language === "zh" ? "本次会话 Agent" : "Draft agent";
  const runtimePickerLabel =
    language === "zh" ? "选择会话类型" : "Choose session type";
  const agentPicker = page.locator(`button[aria-label="${agentPickerLabel}"]`);
  await agentPicker.waitFor({ state: "visible", timeout: 10_000 });
  await agentPicker.click();

  const preferredAgentNames =
    language === "zh"
      ? ["代码侠", "Builder", "Main Agent", "Main"]
      : ["Main", "Main Agent", "Builder", "代码侠"];
  for (const name of preferredAgentNames) {
    const option = page.locator('[role="option"]').filter({ hasText: name });
    if ((await option.count()) === 1) {
      await option.click();
      const runtimePicker = page.locator(
        `button[aria-label="${runtimePickerLabel}"]`,
      );
      await runtimePicker.waitFor({ state: "visible", timeout: 10_000 });
      await runtimePicker.click();
      await page
        .getByText("Codex", { exact: true })
        .waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(500);
      return;
    }
  }

  throw new Error(
    "failed to locate a representative Agent in the welcome picker",
  );
}

export function createAgentRuntimeScreenshotScenes() {
  return [
    {
      id: "agent-runtime-en",
      route: "/chat",
      language: "en",
      realAppOnly: true,
      afterLoad: async ({ page }) => openAgentRuntimePicker(page, "en"),
      outputs: ["images/screenshots/nextclaw-agent-runtime-picker-en.png"],
    },
    {
      id: "agent-runtime-zh",
      route: "/chat",
      language: "zh",
      realAppOnly: true,
      afterLoad: async ({ page }) => openAgentRuntimePicker(page, "zh"),
      outputs: ["images/screenshots/nextclaw-agent-runtime-picker-cn.png"],
    },
  ];
}
