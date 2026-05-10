export type IngressEnvelope<TPayload = unknown> = {
  type: string;
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
  private readonly handlers = new Map<string, IngressHandler>();

  readonly addHandler = (type: string, handler: IngressHandler): void => {
    const normalizedType = type.trim();
    if (!normalizedType) {
      throw new Error("ingress type is required");
    }
    this.handlers.set(normalizedType, handler);
  };

  readonly handle = async (
    envelope: IngressEnvelope,
    context: IngressContext,
  ): Promise<unknown> => {
    const normalizedType = envelope.type.trim();
    const handler = this.handlers.get(normalizedType);
    if (!handler) {
      throw new Error(`Unsupported ingress type: ${envelope.type}`);
    }
    return await handler(envelope, context);
  };
}
