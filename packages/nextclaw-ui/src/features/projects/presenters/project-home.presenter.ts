export type ProjectHomeTab =
  | "overview"
  | "work"
  | "artifacts"
  | "skills"
  | "agreement";

export function isProjectHomeTab(
  value: string | undefined,
): value is ProjectHomeTab {
  return (
    value === "overview" ||
    value === "work" ||
    value === "artifacts" ||
    value === "skills" ||
    value === "agreement"
  );
}
