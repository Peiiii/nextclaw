import {
  type INextclawHarness,
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
