export type ProjectWorkErrorCode =
  | "PROJECT_NOT_FOUND"
  | "PROJECT_WORK_ARTIFACT_INVALID"
  | "PROJECT_WORK_ARTIFACT_NOT_FOUND"
  | "PROJECT_WORK_ITEM_NOT_FOUND"
  | "PROJECT_WORK_STATE_IN_USE"
  | "PROJECT_WORK_STATE_INVALID"
  | "PROJECT_WORK_STATE_NOT_FOUND"
  | "PROJECT_WORK_VALIDATION_FAILED"
  | "PROJECT_WORK_VERSION_CONFLICT";

export class ProjectWorkError extends Error {
  constructor(
    readonly code: ProjectWorkErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProjectWorkError";
  }
}

export function isProjectWorkError(error: unknown): error is ProjectWorkError {
  return error instanceof ProjectWorkError;
}
