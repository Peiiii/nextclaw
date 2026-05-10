import { EventBus, Ingress } from "@nextclaw/shared";

export type NextClawApp = {
  readonly eventBus: EventBus;
  readonly ingress: Ingress;
};

export const nextclaw: NextClawApp = {
  eventBus: new EventBus(),
  ingress: new Ingress(),
};
