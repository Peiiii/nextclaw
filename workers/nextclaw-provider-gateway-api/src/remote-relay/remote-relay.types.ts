export type HeaderEntry = [string, string];
export type WebSocketMessageData = string | ArrayBuffer | ArrayBufferView;

export type RelayRequestFrame = {
  type: "request";
  requestId: string;
  method: string;
  path: string;
  headers: HeaderEntry[];
  bodyBase64?: string;
};

export type RelayResponseFrame =
  | {
    type: "response";
    requestId: string;
    status: number;
    headers: HeaderEntry[];
    bodyBase64?: string;
  }
  | {
    type: "response.start";
    requestId: string;
    status: number;
    headers: HeaderEntry[];
  }
  | {
    type: "response.chunk";
    requestId: string;
    bodyBase64: string;
  }
  | {
    type: "response.end";
    requestId: string;
  }
  | {
    type: "response.error";
    requestId: string;
    message: string;
  };

export type ConnectorAttachment = {
  type: "connector";
  deviceId: string;
  connectedAt: string;
};

export type ClientAttachment = {
  type: "client";
  clientId: string;
  userId: string;
  sessionId: string;
  instanceId: string;
  quotaTicket: string;
  connectedAt: string;
};

export type BrowserCommandFrame =
  | { type: "request"; id: string; target: { method: string; path: string; body?: unknown } }
  | { type: "stream.open"; streamId: string; target: { method: string; path: string; body?: unknown } }
  | { type: "stream.cancel"; streamId: string };

export type ConnectorClientFrame =
  | { type: "client.request"; clientId: string; id: string; target: { method: string; path: string; body?: unknown } }
  | { type: "client.response"; clientId: string; id: string; status: number; body?: unknown }
  | {
    type: "client.request.error";
    clientId: string;
    id: string;
    message: string;
    code?: string;
    retryAfterSeconds?: number;
  }
  | { type: "client.stream.open"; clientId: string; streamId: string; target: { method: string; path: string; body?: unknown } }
  | { type: "client.stream.event"; clientId: string; streamId: string; event: string; payload?: unknown }
  | { type: "client.stream.end"; clientId: string; streamId: string }
  | {
    type: "client.stream.error";
    clientId: string;
    streamId: string;
    message: string;
    code?: string;
    retryAfterSeconds?: number;
  }
  | { type: "client.stream.cancel"; clientId: string; streamId: string }
  | { type: "client.event"; event: unknown };

export type PendingRelay = {
  responsePromise: Promise<Response>;
  resolveResponse: (response: Response) => void;
  rejectResponse: (error: Error) => void;
  writer: WritableStreamDefaultWriter<Uint8Array> | null;
  timeoutId: ReturnType<typeof setTimeout>;
};
