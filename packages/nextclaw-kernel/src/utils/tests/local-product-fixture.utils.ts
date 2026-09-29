import { LocalProduct, type NextclawApplicationOptions } from "@kernel/features/node-platform/services/local-product.service.js";
import { NextclawHarness } from "@kernel/features/harness/managers/nextclaw-harness.manager.js";

export async function createLocalProductFixture(options: NextclawApplicationOptions = {}) {
  const product = new LocalProduct({ sessionSearchEnabled: false, ...options });
  const harness = new NextclawHarness({ platform: product.platform, modules: [product] });
  try {
    await harness.prepare();
    return { kernel: product.kernel, harness };
  } catch (error) {
    await harness.dispose().catch(() => undefined);
    throw error;
  }
}
