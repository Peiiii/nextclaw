import { EventBus } from "@kernel/events/event-bus.service.js";

export type NextClawApp = {
  readonly eventBus: EventBus;
};

export const nextclaw: NextClawApp = {
  eventBus: new EventBus(),
};
