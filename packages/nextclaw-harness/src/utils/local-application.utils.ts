import { LocalProduct, NextclawHarness, type NextclawApplicationOptions,
  type NextclawTaskInput, type NextclawTaskResult } from "@nextclaw/kernel";

/** Prepares management owners; callers wire their host before Harness.start(). */
export async function createNextclawApplication(options: NextclawApplicationOptions = {}) {
  const product = new LocalProduct(options);
  const harness = new NextclawHarness({ platform: product.platform, modules: [product],
    allowSlashCommands: options.allowedToolNames === undefined });
  try {
    await harness.prepare();
    return { harness, kernel: product.kernel };
  } catch (error) {
    await harness.dispose().catch(() => undefined);
    throw error;
  }
}

export async function runNextclawTask(input: NextclawTaskInput,
  options: NextclawApplicationOptions = {}): Promise<NextclawTaskResult> {
  const { harness, kernel } = await createNextclawApplication(options);
  try {
    await kernel.extensions.load({ config: kernel.configManager.config });
    await harness.start();
    return await harness.runTask(input);
  } finally { await harness.dispose(); }
}

export type { NextclawApplicationOptions } from "@nextclaw/kernel";
