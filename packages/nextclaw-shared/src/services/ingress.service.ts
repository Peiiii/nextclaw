import { getKeyId, type Key } from "../types/typed-key.types.js";

export type IngressEnvelope<TPayload = unknown> = {
  type: Key<TPayload>;
  extensionId?: string;
  payload?: TPayload;
  source?: string;
};

export type IngressContext = {
  source: string;
  token?: string | null;
};

export type IngressHandler<TPayload = unknown, TResult = unknown> = (
  envelope: IngressEnvelope<TPayload>,
  context: IngressContext,
) => Promise<TResult> | TResult;

export class Ingress {
  private readonly handlers = new Map<string, IngressHandler<unknown, unknown>>();

  readonly addHandler = <TPayload = unknown, TResult = unknown>(
    type: Key<TPayload>,
    handler: IngressHandler<TPayload, TResult>,
  ): (() => void) => {
    const normalizedType = getKeyId(type);
    if (!normalizedType) {
      throw new Error("ingress type is required");
    }
    this.handlers.set(normalizedType, handler as IngressHandler<unknown, unknown>);
    return () => {
      if (this.handlers.get(normalizedType) === handler) {
        this.handlers.delete(normalizedType);
      }
    };
  };

  readonly handle = async <TPayload = unknown, TResult = unknown>(
    envelope: IngressEnvelope<TPayload>,
    context: IngressContext,
  ): Promise<TResult> => {
    const normalizedType = getKeyId(envelope.type);
    const handler = this.handlers.get(normalizedType);
    if (!handler) {
      throw new Error(`Unsupported ingress type: ${normalizedType}`);
    }
    return await (handler as IngressHandler<TPayload, TResult>)(envelope, context);
  };
}
