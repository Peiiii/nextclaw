import { PROJECT_OBSERVATION_PROTOCOL } from "@kernel/features/projects/types/project-observation.types.js";

type MarkerSource = {
  sessionId: string;
  messageId: string;
  timestamp: string;
  line: number;
};

type WorkItemMarker = MarkerSource & {
  kind: "work-item";
  id: string;
  name: string;
  workflowId?: string;
  stageId?: string;
  status: "active" | "blocked" | "completed" | "cancelled";
};

type ArtifactMarker = MarkerSource & {
  kind: "artifact";
  itemId: string;
  path: string;
  categoryId: string;
};

type ScheduleMarker = MarkerSource & {
  kind: "schedule";
  itemId: string;
  start?: string;
  end?: string;
  milestone: boolean;
  dependsOn: string[];
};

type SignalMarker = MarkerSource & {
  kind: "signal";
  id: string;
  itemId?: string;
  status: "open" | "resolved";
  level: "info" | "attention" | "warning";
  message: string;
};

type RequestMarker = MarkerSource & {
  kind: "request";
  id: string;
  itemId?: string;
  status: "open" | "resolved" | "expired";
  response: "confirm-reject" | "open-session";
  prompt: string;
};

export type ProjectObservationMarker =
  | WorkItemMarker
  | ArtifactMarker
  | ScheduleMarker
  | SignalMarker
  | RequestMarker;

export type ProjectObservationMarkerIssue = {
  code: "PROJECT_MARKER_INVALID";
  message: string;
  line: number;
};

export type ProjectObservationResponseMetadata = {
  protocol: typeof PROJECT_OBSERVATION_PROTOCOL;
  requestId: string;
  decision: "confirmed" | "rejected";
};

type WorkItemState = Omit<WorkItemMarker, keyof MarkerSource | "kind">;
type RequestState = Omit<RequestMarker, keyof MarkerSource | "kind">;

export type ProjectObservationMarkerParseState = {
  currentWorkItemIdBySession: Map<string, string>;
  requestsById: Map<string, RequestState>;
  workItemsById: Map<string, WorkItemState>;
};

export function createProjectObservationMarkerParseState(): ProjectObservationMarkerParseState {
  return {
    currentWorkItemIdBySession: new Map(),
    requestsById: new Map(),
    workItemsById: new Map(),
  };
}

const ID_VALUE = "[a-z0-9][a-z0-9._-]*";
const ID = `(${ID_VALUE})`;
const OPTIONAL_ID = `(${ID_VALUE}|none)`;
const TEXT = '([^"\\]\\r\\n]{1,240})';
const DATE = "(\\d{4}-\\d{2}-\\d{2}|none)";
const PREFIX = "\\[nextclaw\\.project/v1 ";

const LEGACY_WORK_ITEM_PATTERN = new RegExp(
  `^${PREFIX}kind=work-item id=${ID} title="${TEXT}" workflow=${OPTIONAL_ID} stage=${OPTIONAL_ID} status=(active|blocked|completed|cancelled)\\]$`,
);
const LEGACY_ARTIFACT_PATTERN = new RegExp(
  `^${PREFIX}kind=artifact item=${ID} path="${TEXT}" category=${ID}\\]$`,
);
const LEGACY_SCHEDULE_PATTERN = new RegExp(
  `^${PREFIX}kind=schedule item=${ID} start=${DATE} end=${DATE} milestone=(true|false) depends-on=([a-z0-9._,-]+|none)\\]$`,
);
const LEGACY_SIGNAL_PATTERN = new RegExp(
  `^${PREFIX}kind=signal id=${ID} item=${OPTIONAL_ID} status=(open|resolved) level=(info|attention|warning) message="${TEXT}"\\]$`,
);
const LEGACY_REQUEST_PATTERN = new RegExp(
  `^${PREFIX}kind=request id=${ID} item=${OPTIONAL_ID} status=(open|resolved|expired) response=(confirm-reject|open-session) prompt="${TEXT}"\\]$`,
);

const ID_PATTERN = new RegExp(`^${ID_VALUE}$`);
const FIELD_PATTERN = /([a-z][a-z-]*)=(?:"([^"\\\]\r\n]{1,240})"|([^\s\]]+))/y;
const WORK_ITEM_STATUSES = new Set<WorkItemMarker["status"]>([
  "active",
  "blocked",
  "completed",
  "cancelled",
]);
const REQUEST_STATUSES = new Set<RequestMarker["status"]>([
  "open",
  "resolved",
  "expired",
]);
const REQUEST_RESPONSES = new Set<RequestMarker["response"]>([
  "confirm-reject",
  "open-session",
]);

const optional = (value: string): string | undefined => value === "none" ? undefined : value;

function parseFields(value: string): Map<string, string> | null {
  const fields = new Map<string, string>();
  let cursor = 0;
  while (cursor < value.length) {
    FIELD_PATTERN.lastIndex = cursor;
    const match = FIELD_PATTERN.exec(value);
    if (!match || fields.has(match[1])) {
      return null;
    }
    fields.set(match[1], match[2] ?? match[3]);
    cursor = FIELD_PATTERN.lastIndex;
    if (cursor === value.length) {
      break;
    }
    if (value[cursor] !== " ") {
      return null;
    }
    cursor += 1;
  }
  return fields;
}

function hasOnlyFields(fields: Map<string, string>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return [...fields.keys()].every((key) => allowedSet.has(key));
}

function rememberWorkItem(
  marker: WorkItemMarker,
  state: ProjectObservationMarkerParseState,
): void {
  state.currentWorkItemIdBySession.set(marker.sessionId, marker.id);
  state.workItemsById.set(marker.id, {
    id: marker.id,
    name: marker.name,
    ...(marker.workflowId ? { workflowId: marker.workflowId } : {}),
    ...(marker.stageId ? { stageId: marker.stageId } : {}),
    status: marker.status,
  });
}

function rememberRequest(
  marker: RequestMarker,
  state: ProjectObservationMarkerParseState,
): void {
  state.requestsById.set(marker.id, {
    id: marker.id,
    ...(marker.itemId ? { itemId: marker.itemId } : {}),
    status: marker.status,
    response: marker.response,
    prompt: marker.prompt,
  });
}

function parseLegacyMarkerLine(
  line: string,
  source: MarkerSource,
  state: ProjectObservationMarkerParseState,
): ProjectObservationMarker | null {
  let match = LEGACY_WORK_ITEM_PATTERN.exec(line);
  if (match) {
    const marker: WorkItemMarker = {
      ...source,
      kind: "work-item",
      id: match[1],
      name: match[2],
      ...(optional(match[3]) ? { workflowId: optional(match[3]) } : {}),
      ...(optional(match[4]) ? { stageId: optional(match[4]) } : {}),
      status: match[5] as WorkItemMarker["status"],
    };
    rememberWorkItem(marker, state);
    return marker;
  }
  match = LEGACY_ARTIFACT_PATTERN.exec(line);
  if (match) {
    return { ...source, kind: "artifact", itemId: match[1], path: match[2], categoryId: match[3] };
  }
  match = LEGACY_SCHEDULE_PATTERN.exec(line);
  if (match) {
    return {
      ...source,
      kind: "schedule",
      itemId: match[1],
      ...(optional(match[2]) ? { start: optional(match[2]) } : {}),
      ...(optional(match[3]) ? { end: optional(match[3]) } : {}),
      milestone: match[4] === "true",
      dependsOn: match[5] === "none" ? [] : match[5].split(","),
    };
  }
  match = LEGACY_SIGNAL_PATTERN.exec(line);
  if (match) {
    return {
      ...source,
      kind: "signal",
      id: match[1],
      ...(optional(match[2]) ? { itemId: optional(match[2]) } : {}),
      status: match[3] as SignalMarker["status"],
      level: match[4] as SignalMarker["level"],
      message: match[5],
    };
  }
  match = LEGACY_REQUEST_PATTERN.exec(line);
  if (match) {
    const marker: RequestMarker = {
      ...source,
      kind: "request",
      id: match[1],
      ...(optional(match[2]) ? { itemId: optional(match[2]) } : {}),
      status: match[3] as RequestMarker["status"],
      response: match[4] as RequestMarker["response"],
      prompt: match[5],
    };
    rememberRequest(marker, state);
    return marker;
  }
  return null;
}

function parseCompactWorkItem(
  body: string,
  source: MarkerSource,
  state: ProjectObservationMarkerParseState,
): WorkItemMarker | null {
  const fields = parseFields(body);
  if (!fields || fields.size === 0 || !hasOnlyFields(fields, ["id", "name", "workflow", "stage", "status"])) {
    return null;
  }
  const explicitId = fields.get("id");
  if (explicitId && !ID_PATTERN.test(explicitId)) {
    return null;
  }
  const id = explicitId ?? state.currentWorkItemIdBySession.get(source.sessionId);
  if (!id) {
    return null;
  }
  const previous = state.workItemsById.get(id);
  const explicitName = fields.get("name");
  if (!previous && (!explicitName || !fields.has("stage"))) {
    return null;
  }
  if (previous && explicitName && explicitName !== previous.name) {
    return null;
  }
  const statusValue = fields.get("status");
  if (statusValue && !WORK_ITEM_STATUSES.has(statusValue as WorkItemMarker["status"])) {
    return null;
  }
  const workflowValue = fields.get("workflow");
  const stageValue = fields.get("stage");
  if ((workflowValue && workflowValue !== "none" && !ID_PATTERN.test(workflowValue)) ||
      (stageValue && stageValue !== "none" && !ID_PATTERN.test(stageValue))) {
    return null;
  }
  const workflowId = workflowValue === undefined ? previous?.workflowId : optional(workflowValue);
  const stageId = stageValue === undefined ? previous?.stageId : optional(stageValue);
  const marker: WorkItemMarker = {
    ...source,
    kind: "work-item",
    id,
    name: explicitName ?? previous!.name,
    ...(workflowId ? { workflowId } : {}),
    ...(stageId ? { stageId } : {}),
    status: statusValue as WorkItemMarker["status"]
      ?? (fields.has("stage") ? "active" : previous?.status ?? "active"),
  };
  rememberWorkItem(marker, state);
  return marker;
}

function parseCompactArtifact(
  body: string,
  source: MarkerSource,
  state: ProjectObservationMarkerParseState,
): ArtifactMarker | null {
  const fields = parseFields(body);
  if (!fields || !hasOnlyFields(fields, ["path", "category", "work-id"])) {
    return null;
  }
  const path = fields.get("path");
  const categoryId = fields.get("category");
  const itemId = fields.get("work-id") ?? state.currentWorkItemIdBySession.get(source.sessionId);
  if (!path || !categoryId || !itemId || !ID_PATTERN.test(categoryId) || !ID_PATTERN.test(itemId)) {
    return null;
  }
  return { ...source, kind: "artifact", itemId, path, categoryId };
}

function parseCompactRequest(
  body: string,
  source: MarkerSource,
  state: ProjectObservationMarkerParseState,
): RequestMarker | null {
  const fields = parseFields(body);
  if (!fields || !hasOnlyFields(fields, ["request", "work-id", "status", "response", "prompt"])) {
    return null;
  }
  const id = fields.get("request");
  if (!id || !ID_PATTERN.test(id)) {
    return null;
  }
  const previous = state.requestsById.get(id);
  const itemId = fields.get("work-id") ?? previous?.itemId ?? state.currentWorkItemIdBySession.get(source.sessionId);
  const statusValue = fields.get("status") ?? previous?.status ?? "open";
  const responseValue = fields.get("response") ?? previous?.response;
  const prompt = fields.get("prompt") ?? previous?.prompt;
  if (!responseValue || !prompt ||
      !REQUEST_STATUSES.has(statusValue as RequestMarker["status"]) ||
      !REQUEST_RESPONSES.has(responseValue as RequestMarker["response"]) ||
      (itemId && !ID_PATTERN.test(itemId))) {
    return null;
  }
  const marker: RequestMarker = {
    ...source,
    kind: "request",
    id,
    ...(itemId ? { itemId } : {}),
    status: statusValue as RequestMarker["status"],
    response: responseValue as RequestMarker["response"],
    prompt,
  };
  rememberRequest(marker, state);
  return marker;
}

function parseCompactMarkerLine(
  line: string,
  source: MarkerSource,
  state: ProjectObservationMarkerParseState,
): ProjectObservationMarker | null {
  const prefix = `[${PROJECT_OBSERVATION_PROTOCOL} `;
  if (!line.startsWith(prefix) || !line.endsWith("]")) {
    return null;
  }
  const body = line.slice(prefix.length, -1);
  if (body.startsWith("artifact ")) {
    return parseCompactArtifact(body.slice("artifact ".length), source, state);
  }
  if (body.startsWith("request=")) {
    return parseCompactRequest(body, source, state);
  }
  return parseCompactWorkItem(body, source, state);
}

export function parseProjectObservationMarkers(params: Omit<MarkerSource, "line"> & {
  text: string;
  reportInvalid?: boolean;
  state?: ProjectObservationMarkerParseState;
}): {
  markers: ProjectObservationMarker[];
  issues: ProjectObservationMarkerIssue[];
} {
  const markers: ProjectObservationMarker[] = [];
  const issues: ProjectObservationMarkerIssue[] = [];
  const state = params.state ?? createProjectObservationMarkerParseState();
  let insideFencedCodeBlock = false;
  params.text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (line.startsWith("```")) {
      insideFencedCodeBlock = !insideFencedCodeBlock;
      return;
    }
    if (insideFencedCodeBlock) {
      return;
    }
    if (!line.startsWith(`[${PROJECT_OBSERVATION_PROTOCOL}`)) {
      return;
    }
    const source: MarkerSource = {
      sessionId: params.sessionId,
      messageId: params.messageId,
      timestamp: params.timestamp,
      line: index + 1,
    };
    const marker = line.includes(" kind=")
      ? parseLegacyMarkerLine(line, source, state)
      : parseCompactMarkerLine(line, source, state);
    if (marker) {
      markers.push(marker);
      return;
    }
    if (params.reportInvalid !== false) {
      issues.push({
        code: "PROJECT_MARKER_INVALID",
        message: `Invalid ${PROJECT_OBSERVATION_PROTOCOL} marker at line ${index + 1}.`,
        line: index + 1,
      });
    }
  });
  return { markers, issues };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export function readProjectObservationResponseMetadata(
  metadata: Record<string, unknown> | undefined,
): ProjectObservationResponseMetadata | null {
  const response = metadata?.project_observation_response;
  if (
    !isRecord(response) ||
    response.protocol !== PROJECT_OBSERVATION_PROTOCOL ||
    typeof response.requestId !== "string" ||
    (response.decision !== "confirmed" && response.decision !== "rejected")
  ) {
    return null;
  }
  return {
    protocol: PROJECT_OBSERVATION_PROTOCOL,
    requestId: response.requestId,
    decision: response.decision,
  };
}
