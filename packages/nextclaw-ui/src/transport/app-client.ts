import { API_BASE } from '@/api/api-base';
import { LocalAppTransport } from './local.transport';
import { RemoteSessionMultiplexTransport } from './remote.transport';
import type { AppTransport, RemoteRuntimeInfo, RequestInput, StreamInput, StreamSession } from './transport.types';

const REMOTE_RUNTIME_PATH = '/_remote/runtime';
const DEFAULT_REMOTE_RUNTIME: RemoteRuntimeInfo = {
  mode: 'remote',
  protocolVersion: 1,
  wsPath: '/_remote/ws'
};

async function resolveRuntime(apiBase: string): Promise<AppTransport> {
  const runtimeUrl = `${apiBase.replace(/\/$/, '')}${REMOTE_RUNTIME_PATH}`;
  let response: Response;
  try {
    response = await fetch(runtimeUrl, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store'
    });
  } catch {
    return new LocalAppTransport({ apiBase });
  }

  if (response.status === 404) {
    return new LocalAppTransport({ apiBase });
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.includes('application/json')) {
    return response.status >= 400
      ? new RemoteSessionMultiplexTransport(DEFAULT_REMOTE_RUNTIME, apiBase)
      : new LocalAppTransport({ apiBase });
  }

  let payload: { ok?: boolean; data?: RemoteRuntimeInfo } | null = null;
  try {
    payload = await response.json() as { ok?: boolean; data?: RemoteRuntimeInfo };
  } catch {
    return response.status >= 400
      ? new RemoteSessionMultiplexTransport(DEFAULT_REMOTE_RUNTIME, apiBase)
      : new LocalAppTransport({ apiBase });
  }

  if (response.ok && payload.ok && payload.data?.mode === 'remote') {
    return new RemoteSessionMultiplexTransport(payload.data, apiBase);
  }

  if (response.status >= 400) {
    return new RemoteSessionMultiplexTransport(DEFAULT_REMOTE_RUNTIME, apiBase);
  }

  return new LocalAppTransport({ apiBase });
}

class AppClient {
  private transportPromise: Promise<AppTransport> | null = null;

  constructor(private readonly apiBase: string = API_BASE) {}

  private async getTransport(): Promise<AppTransport> {
    if (!this.transportPromise) {
      this.transportPromise = resolveRuntime(this.apiBase);
    }
    return await this.transportPromise;
  }

  async request<T>(input: RequestInput): Promise<T> {
    return await (await this.getTransport()).request<T>(input);
  }

  openStream<TFinal = unknown>(input: StreamInput): StreamSession<TFinal> {
    let currentSession: StreamSession<TFinal> | null = null;
    let resolveFinished!: (value: TFinal) => void;
    let rejectFinished!: (error: Error) => void;
    const finished = new Promise<TFinal>((resolve, reject) => {
      resolveFinished = resolve;
      rejectFinished = reject;
    });

    void this.getTransport()
      .then((transport) => {
        currentSession = transport.openStream<TFinal>(input);
        void currentSession.finished.then(resolveFinished).catch((error) => {
          rejectFinished(error instanceof Error ? error : new Error(String(error)));
        });
      })
      .catch((error) => {
        rejectFinished(error instanceof Error ? error : new Error(String(error)));
      });

    return {
      finished,
      cancel: () => currentSession?.cancel()
    };
  }

  subscribe(handler: (event: Parameters<Parameters<AppTransport['subscribe']>[0]>[0]) => void): () => void {
    let unsubscribe = () => {};
    let active = true;
    void this.getTransport().then((transport) => {
      if (!active) {
        return;
      }
      unsubscribe = transport.subscribe(handler);
    }).catch((error) => {
      handler({
        type: 'connection.error',
        payload: {
          message: error instanceof Error ? error.message : String(error)
        }
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }
}

export const appClient = new AppClient();
