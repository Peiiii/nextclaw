import { create } from "zustand";
import type { SupportReceipt, SupportReport } from "@shared/support-feedback.types";
export const useSupportStore = create<{
  draft: { title: string; description: string; environment: string; version: string };
  receipts: SupportReceipt[]; selected: SupportReport | null; reply: string;
  busy: boolean; error: string; notice: string;
}>(() => ({
  draft: { title: "", description: "", environment: "", version: "" }, receipts: [], selected: null, reply: "",
  busy: false, error: "", notice: ""
}));
