export type Disposer = () => Promise<void> | void;

export type EffectSetup = () =>
  | Promise<Disposer | void>
  | Disposer
  | void;

export interface IContribution {
  start(): Promise<void> | void;
  dispose(): Promise<void> | void;
}
