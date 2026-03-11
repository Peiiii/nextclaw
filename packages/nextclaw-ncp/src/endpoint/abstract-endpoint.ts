import type {
  Endpoint,
  EndpointEvent,
  EndpointSubscriber,
  OutboundEnvelope,
  SendReceipt,
} from "../types/endpoint.js";
import type { EndpointManifest } from "../types/manifest.js";

// Draft-level skeleton:
// - Provides the minimal shared lifecycle + subscription layer for endpoints.
// - Concrete transport/auth/send behavior is implemented by subclasses.
export abstract class AbstractEndpoint implements Endpoint {
  abstract readonly manifest: EndpointManifest;

  private started = false;
  private readonly listeners = new Set<EndpointSubscriber>();

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    await this.onStart();
    this.started = true;
    this.emit({ type: "endpoint.ready" });
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    await this.onStop();
    this.started = false;
  }

  async send(message: OutboundEnvelope): Promise<SendReceipt> {
    this.assertStarted();
    return this.onSend(message);
  }

  subscribe(listener: EndpointSubscriber): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  protected emit(event: EndpointEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  protected assertStarted(): void {
    if (!this.started) {
      throw new Error(`endpoint "${this.manifest.endpointId}" is not started`);
    }
  }

  // Lifecycle/send hooks to be implemented in concrete endpoint adapters.
  protected abstract onStart(): Promise<void>;
  protected abstract onStop(): Promise<void>;
  protected abstract onSend(message: OutboundEnvelope): Promise<SendReceipt>;
}
