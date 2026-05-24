export type KernelContribution = {
  start: () => void;
  dispose: () => Promise<void> | void;
};
