export type UiShowContentPurpose = "read" | "preview" | "edit" | "interact";
export type UiShowContentPlacement = "inline" | "side_panel";
export type UiShowContentFileViewer = "auto" | "source" | "rendered";
export type UiContentParamValue =
  | null
  | boolean
  | number
  | string
  | UiContentParamValue[]
  | { [key: string]: UiContentParamValue };
export type UiContentParams = Record<string, UiContentParamValue>;

export type UiShowContentTarget =
  | {
      type: "file";
      payload: {
        path: string;
        line: number | undefined;
        column: number | undefined;
        viewer: UiShowContentFileViewer | undefined;
        params?: UiContentParams;
      };
    }
  | {
      type: "url";
      payload: {
        url: string;
      };
    }
  | {
      type: "panel_app";
      payload: {
        appId: string;
        path?: string;
        params?: UiContentParams;
      };
    };

export type UiShowContentEventPayload = {
  id: string;
  toolCallId: string | undefined;
  target: UiShowContentTarget;
  title: string | undefined;
  purpose: UiShowContentPurpose | undefined;
  placement: UiShowContentPlacement | undefined;
};
