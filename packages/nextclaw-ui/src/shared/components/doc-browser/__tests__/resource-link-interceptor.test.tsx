import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import {
  ChatMessageMarkdown,
  ChatResourceLinkProvider,
} from "@nextclaw/agent-chat-ui";
import { AppPresenterProvider } from "@/app/components/app-presenter-provider";
import { getPresenter } from "@/app/presenters/app.presenter";
import { useDocLinkInterceptor } from "@/shared/components/doc-browser/use-doc-link-interceptor";
import { useDocBrowserStore } from "@/shared/components/doc-browser/stores/doc-browser.store";
import { createDefaultDocBrowserState } from "@/shared/components/doc-browser/utils/doc-browser-state.utils";
import { PageResourceIcon } from "@/features/right-panel-resources";
import { pageResourceTab } from "@/features/right-panel-resources";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function LinkedMarkdown({
  text = "[Notes](nextclaw://panel-app/example-notes)",
}: {
  text?: string;
}) {
  useDocLinkInterceptor();
  const { pathname } = useLocation();
  return (
    <>
      <output data-testid="route">{pathname}</output>
      <ChatResourceLinkProvider
        renderIcon={(uri) => (
          <PageResourceIcon uri={uri} icon={{ type: "text", value: "✎" }} />
        )}
      >
        <ChatMessageMarkdown
          text={text}
          role="assistant"
          texts={{ copyCodeLabel: "Copy", copiedCodeLabel: "Copied" }}
        />
      </ChatResourceLinkProvider>
    </>
  );
}

describe("ordinary Markdown resource links end to end", () => {
  beforeEach(() =>
    useDocBrowserStore.setState({ snapshot: createDefaultDocBrowserState() }),
  );
  function setup(text?: string) {
    return render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={["/chat"]}>
          <AppPresenterProvider>
            <LinkedMarkdown text={text} />
          </AppPresenterProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }
  it.each(["cron-job", "skill", "agent", "project", "inbox-delivery"])(
    "opens a normal Markdown %s object link in the shared resource viewer",
    (kind) => {
      const uri = "nextclaw://objects/" + kind + "/existing-object";
      setup("[Object](" + uri + ")");
      fireEvent.click(screen.getByRole("link", { name: "Object" }));
      const { snapshot } = useDocBrowserStore.getState();
      expect(snapshot.isOpen).toBe(true);
      expect(
        snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId),
      ).toMatchObject({
        kind: "system-object",
        resourceUri: uri,
        title: "Object",
      });
      expect(screen.getByTestId("route").textContent).toBe("/chat");
    },
  );
  it("opens a normal Panel App link in the global sidebar without a catalog lookup", () => {
    setup();
    const link = screen.getByRole("link", { name: "Notes" });
    expect(link.querySelector("span")?.textContent).toContain("✎");
    fireEvent.click(link);
    expect(screen.getByTestId("route").textContent).toBe("/chat");
    const { snapshot } = useDocBrowserStore.getState();
    expect(snapshot.isOpen).toBe(true);
    expect(snapshot.tabs.find((tab) => tab.id === snapshot.activeTabId)).toMatchObject({ kind: "panel-app", resourceUri: "nextclaw://panel-app/example-notes" });
  });
  it("focuses an existing global tab without navigating the main conversation away", () => {
    const page = getPresenter().pageResourceManager.resolve(
      "nextclaw://panel-app/example-notes",
    )!;
    const tab = pageResourceTab(page);
    useDocBrowserStore.setState({
      snapshot: {
        ...createDefaultDocBrowserState(),
        isOpen: true,
        tabs: [tab],
        activeTabId: tab.id,
      },
    });
    setup();
    fireEvent.click(screen.getByRole("link", { name: "Notes" }));
    expect(screen.getByTestId("route").textContent).toBe("/chat");
    expect(useDocBrowserStore.getState().snapshot.tabs).toHaveLength(1);
    expect(useDocBrowserStore.getState().snapshot.isOpen).toBe(true);
  });
});
