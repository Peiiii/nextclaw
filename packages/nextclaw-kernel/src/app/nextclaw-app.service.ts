import { EventBus } from "@nextclaw/shared";

export type NextClawApp = {
  readonly eventBus: EventBus;
};

export const nextclaw: NextClawApp = {
  eventBus: new EventBus(),
};
