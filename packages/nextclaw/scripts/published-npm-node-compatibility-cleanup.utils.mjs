const RETRYABLE_WINDOWS_CLEANUP_ERRORS = new Set(["EBUSY", "ENOTEMPTY", "EPERM"]);

export function cleanupPublishedInstallRoot({ installRoot, remove, warn }) {
  try {
    remove(installRoot, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 500,
    });
    return true;
  } catch (error) {
    if (!RETRYABLE_WINDOWS_CLEANUP_ERRORS.has(error?.code)) throw error;
    warn(
      `[nextclaw:npm-node-compatibility] temporary fixture cleanup deferred after ${error.code}: ${installRoot}`,
    );
    return false;
  }
}
