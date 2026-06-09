export type UiShowContentPurpose = "read" | "preview" | "edit" | "interact";

export type UiShowContentTarget =
  | {
      type: "file";
      payload: {
        path: string;
        line: number | undefined;
        column: number | undefined;
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
      };
    };

export type UiShowContentEventPayload = {
  id: string;
  toolCallId: string | undefined;
  target: UiShowContentTarget;
  title: string | undefined;
  purpose: UiShowContentPurpose | undefined;
};
