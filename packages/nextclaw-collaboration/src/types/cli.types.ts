import type { CollaborationStore } from "../stores/collaboration.store.js";
export type CliContext = {
  root: () => string;
  open: () => CollaborationStore;
  stopped: (store: CollaborationStore) => void;
};
