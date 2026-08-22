import {
  Contribution as BaseContribution,
  type Disposer,
} from "@nextclaw/shared";
import {
  NextclawHarnessError,
  type IKernel,
  type INextclawContributionRegistry,
  type NextclawContributionDescriptor,
} from "@kernel/features/harness/types/nextclaw-harness.types.js";

const contributionBindings = new WeakMap<
  object,
  { kernel: IKernel; owner: object }
>();

function normalizeContributionId(value: string): string {
  const id = value.trim();
  if (!id) {
    throw new NextclawHarnessError(
      "invalid_input",
      "Contribution id must not be empty.",
    );
  }
  return id;
}

export abstract class Contribution extends BaseContribution {
  readonly id: string;
  readonly version?: string;

  protected constructor(options: { id: string; version?: string }) {
    super();
    this.id = normalizeContributionId(options.id);
    this.version = options.version;
  }

  protected get kernel(): IKernel {
    const binding = contributionBindings.get(this);
    if (!binding) {
      throw new NextclawHarnessError(
        "lifecycle",
        "Contribution is not bound to a Harness.",
      );
    }
    return binding.kernel;
  }
}

function bindContribution(
  contribution: Contribution,
  kernel: IKernel,
  owner: object,
): void {
  const current = contributionBindings.get(contribution);
  if (current && current.owner !== owner) {
    throw new NextclawHarnessError(
      "lifecycle",
      `Contribution cannot be reused across Harness instances: ${contribution.id}`,
    );
  }
  contributionBindings.set(contribution, { kernel, owner });
}

export class NextclawContributionRegistry
  implements INextclawContributionRegistry
{
  private readonly registrations = new Map<string, Contribution>();
  private started = false;
  private disposed = false;

  register = (contribution: Contribution): Disposer => {
    if (this.disposed || this.started) {
      throw new NextclawHarnessError(
        "lifecycle",
        "Contributions can only be registered before Harness.start().",
      );
    }
    const id = normalizeContributionId(contribution.id);
    if (this.registrations.has(id)) {
      throw new NextclawHarnessError(
        "invalid_input",
        `Contribution is already registered: ${id}`,
      );
    }
    this.registrations.set(id, contribution);
    return () => {
      if (this.started) {
        throw new NextclawHarnessError(
          "lifecycle",
          "A started contribution is owned by the Harness lifecycle.",
        );
      }
      if (this.registrations.get(id) === contribution) {
        this.registrations.delete(id);
      }
    };
  };

  list = (): readonly NextclawContributionDescriptor[] =>
    [...this.registrations.values()].map((contribution) => ({
      id: contribution.id,
      ...(contribution.version ? { version: contribution.version } : {}),
    }));

  start = async (kernel: IKernel): Promise<void> => {
    if (this.disposed) {
      throw new NextclawHarnessError(
        "lifecycle",
        "Harness contributions have been disposed.",
      );
    }
    if (this.started) {
      return;
    }
    const started: Contribution[] = [];
    try {
      for (const contribution of this.registrations.values()) {
        bindContribution(contribution, kernel, this);
        await contribution.start();
        started.push(contribution);
      }
      this.started = true;
    } catch (error) {
      for (const contribution of started.reverse()) {
        try {
          await contribution.dispose();
        } catch {
          // Preserve the contribution startup failure.
        }
      }
      throw error;
    }
  };

  dispose = async (): Promise<void> => {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    const errors: unknown[] = [];
    for (const contribution of [...this.registrations.values()].reverse()) {
      try {
        await contribution.dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    this.registrations.clear();
    if (errors.length === 1) {
      throw errors[0];
    }
    if (errors.length > 1) {
      throw new AggregateError(
        errors,
        "Multiple Harness contributions failed to dispose.",
      );
    }
  };
}
