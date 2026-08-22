import { NextclawHarness } from "@kernel/features/harness/managers/nextclaw-harness.manager.js";
import {
  type INextclawHarness,
  type NextclawHarnessOptions,
  type NextclawTaskInput,
  type NextclawTaskResult,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";

export async function runNextclawTaskWithHarness(
  harness: INextclawHarness,
  input: NextclawTaskInput,
): Promise<NextclawTaskResult> {
  try {
    await harness.start();
    return await harness.runTask(input);
  } finally {
    await harness.dispose();
  }
}

export async function runNextclawTask(
  input: NextclawTaskInput,
  options: NextclawHarnessOptions = {},
): Promise<NextclawTaskResult> {
  return await runNextclawTaskWithHarness(new NextclawHarness(options), input);
}
