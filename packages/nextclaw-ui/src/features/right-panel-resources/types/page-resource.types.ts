import type { DocBrowserRouteTarget } from "@/shared/components/doc-browser/types/doc-browser.types";

/** Resource identity is independent of the surface currently presenting it. */
export type PageResource = {
  uri: string;
  title: string;
  target: DocBrowserRouteTarget;
  mainPath?: string;
};

export type PageOpenLocation = "default" | "main" | "sidebar" | "floating";
