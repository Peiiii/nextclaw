export type ProductActivityKind = "intent_accepted" | "run_succeeded";

export type ProductActivitySource = "direct" | "channel";

export type ProductActivitySignal = {
  kind: ProductActivityKind;
  occurredAt: string;
  source: ProductActivitySource;
};

export type ProductActivitySink = {
  record: (signal: ProductActivitySignal) => Promise<void> | void;
};
