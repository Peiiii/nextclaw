import "./activity-icon.css";

export type ActivityIconState = "idle" | "thinking" | "working" | "saving" | "stopping" | "reconnecting";

/** Visual feedback only; the consumer owns the activity and its accessible label. */
export function ActivityIcon({ state }: { state: ActivityIconState }) {
  return <svg className="ui-activity-icon" data-state={state} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {state === "idle" && <><circle cx="12" cy="12" r="7" opacity=".35" /><circle className="ui-activity-icon__breath" cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></>}
    {state === "thinking" && <><circle cx="12" cy="12" r="7" opacity=".2" /><g className="ui-activity-icon__orbit"><path d="M12 5a7 7 0 0 1 7 7" /><circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none" /></g></>}
    {state === "working" && <g className="ui-activity-icon__bars"><path d="M6 9v6" /><path d="M12 6v12" /><path d="M18 9v6" /></g>}
    {state === "saving" && <><path d="M5 16v3h14v-3" opacity=".55" /><g className="ui-activity-icon__settle"><path d="M12 4v10m-4-4 4 4 4-4" /></g></>}
    {state === "stopping" && <rect className="ui-activity-icon__pause" x="6" y="6" width="12" height="12" rx="3" />}
    {state === "reconnecting" && <g className="ui-activity-icon__reconnect"><path d="M5 10a7 7 0 0 1 12-3l2 2m0-4v4h-4M19 14a7 7 0 0 1-12 3l-2-2m0 4v-4h4" /></g>}
  </svg>;
}
