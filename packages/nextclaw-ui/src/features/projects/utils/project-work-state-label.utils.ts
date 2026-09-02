import { t, type I18nLanguage } from "@/shared/lib/i18n";

const DEFAULT_STATE_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  Backlog: "projectsWorkState_backlog",
  Planned: "projectsWorkState_planned",
  "In Progress": "projectsWorkState_inProgress",
  "In Review": "projectsWorkState_inReview",
  "Awaiting Acceptance": "projectsWorkState_awaitingAcceptance",
  Completed: "projectsWorkState_completed",
  Canceled: "projectsWorkState_canceled",
};

export function getProjectWorkStateLabel(
  name: string,
  language?: I18nLanguage,
): string {
  const messageKey = DEFAULT_STATE_MESSAGE_KEYS[name];
  if (!messageKey) return name;
  return language ? t(messageKey, language) : t(messageKey);
}
