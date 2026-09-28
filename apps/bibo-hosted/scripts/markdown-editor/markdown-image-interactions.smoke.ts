import assert from "node:assert/strict";
import type { Page } from "playwright";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");

export async function checkImageUploads(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, text: string) => Promise<void>) {
  let release = () => {};
  let started = () => {};
  let uploadStarted = new Promise<void>(resolve => { started = resolve; });
  let fail = false;
  await page.route("**/api/assets", async route => {
    await new Promise<void>(resolve => { release = resolve; started(); });
    await route.fulfill({ status: fail ? 503 : 201, json: fail ? { error: "测试上传失败" } : { url: "/api/assets/12345678-1234-4123-8123-123456789012" } });
  });
  await page.route("**/api/assets/*", route => route.fulfill({ contentType: "image/png", body: png }));
  const mode = (name: string) => page.getByRole("group", { name: "文件模式" }).getByRole("button", { name, exact: true });
  const rich = page.locator(".tiptap:visible");
  async function checkSuccessfulUpload() {
    await openSource(page); await replaceSource(page, "Before\n\nTarget");
    await mode("编辑").click();
    await rich.locator(":scope > p").last().click();
    await page.waitForFunction(() => {
      const root = document.querySelector(".tiptap") as HTMLElement & { editor: { state: { selection: { $from: { parent: { textContent: string } } } } } };
      return root.editor.state.selection.$from.parent.textContent === "Target";
    });
    await chooseUpload(page);
    await uploadStarted;
    await page.getByText("正在上传图片…", { exact: true }).waitFor();
    await rich.locator(":scope > p").first().click();
    await page.keyboard.type("During upload ", { delay: 20 });
    release();
    await rich.locator("img[src^='/api/assets/']").waitFor();
    assert.equal(await rich.locator(":scope > p").last().locator("img[src^='/api/assets/']").count(), 1, "async upload retains the insertion block while typing elsewhere");
    assert.match(await rich.locator(":scope > p").first().innerText(), /During upload/);
    await mode("预览").click();
    await page.locator(".ui-markdown-document img[src^='/api/assets/']").waitFor();
    await openSource(page);
    assert.match((await page.locator(".cm-content .cm-line").allTextContents()).join("\n"), /!\[sample\]\(\/api\/assets\//);
  }
  async function checkUploadFailureAndSourceConflict() {
    await mode("编辑").click();
    const before = await rich.innerText();
    fail = true;
    uploadStarted = new Promise<void>(resolve => { started = resolve; });
    await chooseUpload(page);
    await page.getByText("正在上传图片…", { exact: true }).waitFor();
    await uploadStarted; release();
    await page.getByRole("alert").filter({ hasText: "测试上传失败" }).waitFor();
    assert.equal(await rich.innerText(), before, "failed upload does not change the document");
    fail = false;
    uploadStarted = new Promise<void>(resolve => { started = resolve; });
    await chooseUpload(page); await uploadStarted;
    await openSource(page); await replaceSource(page, "Source changed while uploading");
    release();
    await mode("编辑").click();
    await page.getByRole("alert").filter({ hasText: "上传期间源码已修改" }).waitFor();
    assert.equal(await rich.innerText(), "Source changed while uploading", "late upload cannot overwrite edits made in source mode");
    await page.getByRole("alert").filter({ hasText: "上传期间源码已修改" }).getByRole("button", { name: "关闭", exact: true }).click();
  }
  async function checkClipboardAndDrop() {
    for (const kind of ["paste", "drop"] as const) {
      uploadStarted = new Promise<void>(resolve => { started = resolve; });
      await rich.click();
      await rich.evaluate((element, { kind, bytes }) => {
        const data = new DataTransfer();
        data.items.add(new File([new Uint8Array(bytes)], `${kind}.png`, { type: "image/png" }));
        const box = element.getBoundingClientRect();
        const event = kind === "paste" ? new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })
          : new DragEvent("drop", { dataTransfer: data, clientX: box.left + 30, clientY: box.top + 12, bubbles: true, cancelable: true });
        element.dispatchEvent(event);
      }, { kind, bytes: Array.from(png) });
      await uploadStarted; release();
      await rich.locator(`img[alt='${kind}']`).waitFor();
      assert.equal(await rich.locator(`img[alt='${kind}']`).count(), 1);
    }
  }
  await checkSuccessfulUpload();
  await checkUploadFailureAndSourceConflict();
  await checkClipboardAndDrop();
  await openSource(page); await replaceSource(page, "```text\nkeep-code\n```");
  await mode("编辑").click(); await rich.locator("pre code").click();
  uploadStarted = new Promise<void>(resolve => { started = resolve; });
  await chooseUpload(page); await uploadStarted; release();
  await rich.locator(":scope > p img[src^='/api/assets/']").waitFor();
  assert.equal(await rich.locator("pre code").innerText(), "keep-code", "upload from code inserts a following image paragraph without changing code");
  await page.unroute("**/api/assets"); await page.unroute("**/api/assets/*");
  console.log("Images: upload, concurrent typing, private URL preview/source and failure preservation passed");
  await checkImagePresentation(page, openSource, replaceSource);
}

async function checkImagePresentation(page: Page, openSource: (page: Page) => Promise<void>, replaceSource: (page: Page, text: string) => Promise<void>) {
  await page.route("https://example.com/resize.png", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="180"><rect width="300" height="180" fill="#658975"/></svg>' }));
  await openSource(page); await replaceSource(page, '![Original alt](https://example.com/resize.png "Original caption")');
  const mode = (name: string) => page.getByRole("group", { name: "文件模式" }).getByRole("button", { name, exact: true });
  await mode("编辑").click();
  const rich = page.locator(".tiptap:visible"), image = rich.locator("img[src]");
  await image.waitFor();
  await image.evaluate(element => (element as HTMLImageElement).decode());
  assert.ok(Math.abs((await rich.locator(".ui-rich-image-caption").boundingBox())!.width - (await image.boundingBox())!.width) < 1, "automatic-width captions align with the image, not the paragraph");
  await image.dblclick();
  const inspector = page.getByRole("dialog", { name: "图片", exact: true });
  await inspector.getByLabel("替代文字", { exact: true }).fill("Accessible description");
  await inspector.getByLabel("图片说明", { exact: true }).fill('A "quoted" caption');
  await inspector.getByLabel("宽度（像素）", { exact: true }).fill("180");
  await inspector.getByRole("button", { name: "确认", exact: true }).click();
  assert.equal(Math.round((await image.boundingBox())!.width), 180);
  await checkImageResizeHistory(page);
  await openSource(page);
  const source = (await page.locator(".cm-content .cm-line").allTextContents()).join("\n");
  assert.match(source, /<img[^>]*width="220"/);
  await mode("预览").click();
  const preview = page.locator(".ui-markdown-document img[src]");
  assert.equal(await preview.getAttribute("alt"), "Accessible description");
  assert.equal(Math.round((await preview.boundingBox())!.width), 220);
  assert.equal(await page.locator(".ui-markdown-document .chat-image-caption").innerText(), 'A "quoted" caption');
  await mode("编辑").click();
  assert.equal(Math.round((await image.boundingBox())!.width), 220);
  assert.equal(await rich.locator(".ui-rich-image-caption").innerText(), 'A "quoted" caption');
  console.log("Images: caption/alt, drag/numeric dimensions, undo and read/source round trip passed");
}

async function checkImageResizeHistory(page: Page) {
  const rich = page.locator(".tiptap:visible"), image = rich.locator("img[src]");
  await image.click();
  const handle = rich.locator(".ui-rich-image-resize.is-right"), grip = await handle.boundingBox();
  assert.ok(grip);
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + 40, grip.y + grip.height / 2, { steps: 6 }); await page.mouse.up();
  assert.equal(Math.round((await image.boundingBox())!.width), 220);
  await page.keyboard.press("ControlOrMeta+z");
  assert.equal(Math.round((await image.boundingBox())!.width), 180, "image resize has one undo step");
  await page.keyboard.press("ControlOrMeta+Shift+z");
}

async function chooseUpload(page: Page) {
  await page.getByRole("button", { name: "更多格式", exact: true }).click();
  await page.getByRole("menuitem", { name: "图片", exact: true }).click();
  await page.getByRole("dialog", { name: "图片", exact: true }).locator("input[type=file]").setInputFiles({ name: "sample.png", mimeType: "image/png", buffer: png });
}
