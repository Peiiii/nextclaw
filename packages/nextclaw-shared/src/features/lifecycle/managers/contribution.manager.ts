import { EffectScope } from "./effect-scope.manager.js";
import type {
  Disposer,
  EffectSetup,
  IContribution,
} from "../types/lifecycle.types.js";

type ContributionState = "idle" | "setting-up" | "started";

export abstract class Contribution implements IContribution {
  private effectScope = new EffectScope();
  private state: ContributionState = "idle";
  private startPromise: Promise<void> | undefined;

  protected abstract setup(): Promise<void> | void;

  protected readonly effect = (setup: EffectSetup): Disposer => {
    if (this.state !== "setting-up") {
      throw new Error("Effects can only be declared from setup().");
    }
    return this.effectScope.register(setup);
  };

  start = async (): Promise<void> => {
    if (this.state === "started") {
      return;
    }
    if (this.startPromise) {
      return await this.startPromise;
    }
    this.startPromise = this.startInternal();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = undefined;
    }
  };

  dispose = async (): Promise<void> => {
    if (this.state === "idle" && !this.startPromise) {
      return;
    }
    if (this.startPromise) {
      try {
        await this.startPromise;
      } catch {
        // startInternal already returned this contribution to an idle scope.
      }
    }
    try {
      await this.effectScope.dispose();
    } finally {
      this.effectScope = new EffectScope();
      this.state = "idle";
    }
  };

  private startInternal = async (): Promise<void> => {
    this.state = "setting-up";
    try {
      await this.setup();
      await this.effectScope.start();
      this.state = "started";
    } catch (error) {
      try {
        await this.effectScope.dispose();
      } finally {
        this.effectScope = new EffectScope();
        this.state = "idle";
      }
      throw error;
    }
  };
}
