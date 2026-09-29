import { Contribution, eventKeys } from "@nextclaw/harness";
import type { BiboShowContent } from "@nextclaw/bibo-client";
import type { BiboSpaceService } from "@/features/bibo-domain";
import { createBiboSpaceTool } from "@/features/bibo-domain/tools/bibo-space.tools";

export class BiboSpaceContribution extends Contribution {
  readonly displayEvents: BiboShowContent[] = [];
  constructor(private readonly space: BiboSpaceService, private readonly sessionId: string) {
    super({ id: "bibo.personal-space" });
  }

  protected setup = (): void => {
    this.effect(() => this.kernel.eventBus.on(eventKeys.uiShowContent, (event) => {
      if (event.target.type !== "file" || this.displayEvents.some((item) => item.id === event.id)) return;
      this.displayEvents.push({ id: event.id, sessionId: this.sessionId, ...(event.title ? { title: event.title } : {}),
        target: event.target });
    }));
    this.effect(() => this.kernel.tools.register(createBiboSpaceTool(this.space, this.sessionId)));
  };
}
