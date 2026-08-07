import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProviderModelsSection } from "@/features/settings/components/config/provider-models-section";

const suggestions = vi.hoisted(() => ({
  addSuggestedModels: vi.fn(),
  isCheckingSuggestions: false,
  suggestedModels: [] as string[],
  suggestionSource: "background" as "background" | "fetched",
}));

vi.mock("@/features/settings/hooks/use-provider-model-suggestions", () => ({
  useProviderModelSuggestions: () => suggestions,
}));

function renderSection(
  input: {
    fetchedModels?: string[];
    isDiscoveringModels?: boolean;
    models?: string[];
    onDiscoverModels?: () => Promise<string[] | null>;
    onModelsChange?: (models: string[]) => void;
    supportsModelDiscovery?: boolean;
  } = {},
) {
  const onDiscoverModels =
    input.onDiscoverModels ?? vi.fn(async () => ["model-a"]);
  const onModelsChange = input.onModelsChange ?? vi.fn();
  render(
    <ProviderModelsSection
      providerName="openrouter"
      providerModelAliases={["openrouter"]}
      models={input.models ?? ["gpt-5"]}
      modelConfig={{}}
      modelDraft=""
      showModelInput={false}
      onModelDraftChange={vi.fn()}
      onShowModelInputChange={vi.fn()}
      onAddModel={vi.fn()}
      onModelsChange={onModelsChange}
      supportsModelDiscovery={input.supportsModelDiscovery ?? true}
      onDiscoverModels={onDiscoverModels}
      isDiscoveringModels={input.isDiscoveringModels ?? false}
      fetchedModels={input.fetchedModels ?? []}
      onRemoveModel={vi.fn()}
      onToggleModelThinkingLevel={vi.fn()}
      onSetModelThinkingDefault={vi.fn()}
      onSetModelVision={vi.fn()}
      thinkingLevels={["off", "high"]}
      formatThinkingLevelLabel={(level) => level}
    />,
  );
  return { onDiscoverModels, onModelsChange };
}

describe("ProviderModelsSection", () => {
  beforeEach(() => {
    suggestions.addSuggestedModels.mockReset();
    suggestions.isCheckingSuggestions = false;
    suggestions.suggestedModels = [];
    suggestions.suggestionSource = "background";
  });

  it("exposes a labeled one-click model discovery action", () => {
    const onDiscoverModels = vi.fn(async () => null);
    renderSection({ onDiscoverModels });

    fireEvent.click(screen.getByRole("button", { name: "Fetch model list" }));

    expect(onDiscoverModels).toHaveBeenCalledOnce();
  });

  it("shows a disabled progress state while discovery is running", () => {
    renderSection({ isDiscoveringModels: true });

    expect(screen.getByRole("button", { name: "Fetching..." })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("hides discovery and remote suggestions when the provider does not expose a model list", () => {
    suggestions.suggestedModels = ["qwen3.7-plus"];
    suggestions.isCheckingSuggestions = true;
    renderSection({ supportsModelDiscovery: false });

    expect(
      screen.queryByRole("button", { name: "Fetch model list" }),
    ).toBeNull();
    expect(screen.queryByText("Loading the model catalog…")).toBeNull();
    expect(screen.queryByText("Catalog models not added: 1")).toBeNull();
    expect(screen.getByRole("button", { name: /Add Model/i })).toBeTruthy();
  });

  it("shows automatic suggestions with selected and bulk draft actions", () => {
    suggestions.suggestedModels = [
      "inclusionai/ling-3.0-tiny:free",
      "meta/muse-spark-1.2",
    ];
    renderSection();

    expect(screen.getByText("Catalog models not added: 2")).toBeTruthy();
    expect(screen.queryByText("inclusionai/ling-3.0-tiny:free")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: /Catalog models not added: 2/i }),
    );
    const longModelLabel = screen.getByText("inclusionai/ling-3.0-tiny:free");
    expect(longModelLabel.className).toContain("truncate");
    expect(longModelLabel.closest(".grid")?.className).toContain(
      "grid-cols-[auto_minmax(0,1fr)]",
    );

    expect(screen.getByRole("button", { name: "Add selected" })).toHaveProperty(
      "disabled",
      true,
    );
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select model inclusionai/ling-3.0-tiny:free",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add selected" }));
    fireEvent.click(screen.getByRole("button", { name: "Add all" }));

    expect(suggestions.addSuggestedModels).toHaveBeenNthCalledWith(1, [
      "inclusionai/ling-3.0-tiny:free",
    ]);
    expect(suggestions.addSuggestedModels).toHaveBeenNthCalledWith(
      2,
      suggestions.suggestedModels,
    );
    expect(screen.getByText("0 selected")).toBeTruthy();
    expect(screen.getByText("Save to apply the added models.")).toBeTruthy();
  });

  it("turns a large catalog into searchable selective addition without a bulk-add action", () => {
    suggestions.suggestedModels = Array.from(
      { length: 80 },
      (_, index) => `provider/model-${index + 1}`,
    );
    renderSection();

    fireEvent.click(
      screen.getByRole("button", { name: /Catalog models not added: 80/i }),
    );

    expect(screen.queryByRole("button", { name: "Add all" })).toBeNull();
    expect(screen.getAllByRole("checkbox")).toHaveLength(50);
    expect(
      screen.getByText(
        "Showing the first 50 of 80 matches; refine your search to narrow the list",
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("Search catalog models"), {
      target: { value: "model-80" },
    });
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select model provider/model-80" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Add selected" }));

    expect(suggestions.addSuggestedModels).toHaveBeenCalledWith([
      "provider/model-80",
    ]);
  });

  it("labels and expands a freshly fetched catalog for explicit selection", async () => {
    suggestions.suggestedModels = ["gpt-5.6-sol", "gpt-5.6-terra"];
    suggestions.suggestionSource = "fetched";
    const onDiscoverModels = vi.fn(async () => suggestions.suggestedModels);
    renderSection({
      fetchedModels: suggestions.suggestedModels,
      onDiscoverModels,
    });

    fireEvent.click(screen.getByRole("button", { name: "Fetch model list" }));

    expect(onDiscoverModels).toHaveBeenCalledOnce();
    expect(
      await screen.findByText("2 fetched models available to add"),
    ).toBeTruthy();
    expect(await screen.findByText("gpt-5.6-sol")).toBeTruthy();
  });

  it("explains when every fetched model is already configured instead of asking for an empty selection", () => {
    suggestions.suggestedModels = [];
    suggestions.suggestionSource = "fetched";
    renderSection({ fetchedModels: ["gpt-5"] });

    expect(
      screen.getByText("Fetched 1 models; all are already in the current list"),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Add selected" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add all" })).toBeNull();
  });

  it("shows a quiet loading state while the background catalog is first resolved", () => {
    suggestions.isCheckingSuggestions = true;
    renderSection();

    expect(screen.getByText("Loading the model catalog…")).toBeTruthy();
  });

  it("bulk-selects and removes configured models from the unsaved draft", () => {
    const onModelsChange = vi.fn();
    renderSection({
      models: ["gpt-5", "claude-sonnet-4-6", "deepseek-chat"],
      onModelsChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "Bulk delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(
      screen
        .getAllByRole("checkbox")
        .every((checkbox) => (checkbox as HTMLInputElement).checked),
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(
      screen
        .getAllByRole("checkbox")
        .every((checkbox) => !(checkbox as HTMLInputElement).checked),
    ).toBe(true);

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select model gpt-5" }),
    );
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select model deepseek-chat" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete selected" }));

    expect(onModelsChange).toHaveBeenCalledWith(["claude-sonnet-4-6"]);
    expect(screen.queryByRole("checkbox")).toBeNull();
  });
});
