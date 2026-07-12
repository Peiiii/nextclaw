import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as MarketplaceApi from "@/shared/lib/api";
import {
  createMarketplaceDetailDocId,
  createMarketplaceDetailDocUrl,
  MARKETPLACE_DETAIL_DOC_BROWSER_RENDERERS,
  MARKETPLACE_DETAIL_TAB_KIND,
} from "@/features/marketplace/components/marketplace-detail-doc";
import {
  setMarketplaceDetailDocEntry,
  useMarketplaceDetailDocStore,
} from "@/features/marketplace/stores/marketplace-detail-doc.store";

const mocks = vi.hoisted(() => ({
  fetchMarketplaceSkillContent: vi.fn(),
}));

vi.mock("@/shared/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof MarketplaceApi>();
  return {
    ...actual,
    fetchMarketplaceSkillContent: mocks.fetchMarketplaceSkillContent,
  };
});

vi.mock("@/shared/lib/i18n", () => ({
  t: (key: string) => key,
}));

function renderDetail(detailId: string) {
  const renderer = MARKETPLACE_DETAIL_DOC_BROWSER_RENDERERS[MARKETPLACE_DETAIL_TAB_KIND];
  return render(
    <>
      {renderer?.renderContent?.({
        currentUrl: createMarketplaceDetailDocUrl(detailId),
        open: vi.fn(),
        openTarget: vi.fn(),
        refreshIframe: vi.fn(),
        tab: {
          id: "tab-1",
          kind: MARKETPLACE_DETAIL_TAB_KIND,
          title: "Weather Skill",
          currentUrl: createMarketplaceDetailDocUrl(detailId),
          history: [createMarketplaceDetailDocUrl(detailId)],
          historyIndex: 0,
          navVersion: 0,
        },
      })}
    </>,
  );
}

describe("Marketplace detail doc renderer", () => {
  beforeEach(() => {
    mocks.fetchMarketplaceSkillContent.mockReset();
    useMarketplaceDetailDocStore.setState({ entries: {} });
  });

  it("renders metadata and markdown content as React content", () => {
    const detailId = createMarketplaceDetailDocId("skill", "weather");
    setMarketplaceDetailDocEntry({
      id: detailId,
      title: "Weather Skill",
      typeLabel: "Skill",
      spec: "@nextclaw/weather",
      status: "ready",
      metadataRaw: "name: weather\ndescription: Local weather skill",
      contentRaw: "# Weather Skill\n\nUse **weather** with `city`.\n\n- Local forecast\n- Severe alerts",
    });

    renderDetail(detailId);

    expect(screen.getAllByRole("heading", { name: "Weather Skill", level: 1 })).toHaveLength(2);
    expect(screen.getByText("name")).toBeTruthy();
    expect(screen.getAllByText("weather")).toHaveLength(2);
    expect(screen.getByText("description")).toBeTruthy();
    expect(screen.getByText("city")).toBeTruthy();
    expect(screen.getByText("Local forecast")).toBeTruthy();
    expect(screen.getByText("Severe alerts")).toBeTruthy();
  });

  it("treats unsafe HTML as text, skips nested metadata, and preserves safe links", () => {
    const detailId = createMarketplaceDetailDocId("skill", "unsafe");
    setMarketplaceDetailDocEntry({
      id: detailId,
      title: "Unsafe Skill",
      typeLabel: "Skill",
      spec: "@nextclaw/unsafe",
      status: "ready",
      metadataRaw: '{"name":"unsafe","nested":{"script":"<script>alert(1)</script>"}}',
      contentRaw: "[safe](https://example.com) <script>alert(1)</script>",
    });

    const { container } = renderDetail(detailId);

    expect(screen.queryByText("nested")).toBeNull();
    expect(screen.queryByText('{"script":"<script>alert(1)</script>"}')).toBeNull();
    expect(screen.getByRole("link", { name: "safe" }).getAttribute("href")).toBe("https://example.com");
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getAllByText(/<script>alert\(1\)<\/script>/)).toHaveLength(1);
  });

  it("renders loading state and rehydrates missing skill details after refresh", async () => {
    const loadingId = createMarketplaceDetailDocId("skill", "loading");
    setMarketplaceDetailDocEntry({
      id: loadingId,
      title: "Loading Skill",
      typeLabel: "Skill",
      spec: "@nextclaw/loading",
      status: "loading",
    });

    const { rerender } = renderDetail(loadingId);
    expect(document.querySelector(".animate-pulse")).toBeTruthy();

    mocks.fetchMarketplaceSkillContent.mockResolvedValue({
      metadataRaw: "name: weather",
      bodyRaw: "# Weather Skill\n\nLocal forecast",
      raw: "# Weather Skill\n\nLocal forecast",
      source: "catalog",
      sourceUrl: "https://example.com/weather",
    });

    const missingId = createMarketplaceDetailDocId("skill-preview", "weather");
    const renderer = MARKETPLACE_DETAIL_DOC_BROWSER_RENDERERS[MARKETPLACE_DETAIL_TAB_KIND];
    rerender(
      <>
        {renderer?.renderContent?.({
          currentUrl: createMarketplaceDetailDocUrl(missingId),
          open: vi.fn(),
          openTarget: vi.fn(),
          refreshIframe: vi.fn(),
          tab: {
            id: "tab-1",
            kind: MARKETPLACE_DETAIL_TAB_KIND,
            title: "weather",
            currentUrl: createMarketplaceDetailDocUrl(missingId),
            history: [createMarketplaceDetailDocUrl(missingId)],
            historyIndex: 0,
            navVersion: 0,
          },
        })}
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "weather", level: 1 })).toBeTruthy();
    });
    expect(mocks.fetchMarketplaceSkillContent).toHaveBeenCalledWith("weather");
    expect(screen.getByText("Local forecast")).toBeTruthy();
  });
});
