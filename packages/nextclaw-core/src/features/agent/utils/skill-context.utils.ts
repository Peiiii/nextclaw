function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function readStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => readString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }
  if (typeof value === "string") {
    return value
      .split(/[,\s]+/g)
      .map((entry) => readString(entry))
      .filter((entry): entry is string => Boolean(entry));
  }
  return [];
}

function dedupeRequestedSkills(values: string[]): string[] {
  return Array.from(new Set(values)).slice(0, 8);
}

export type RequestedSkillsSelection = {
  refs: string[];
  names: string[];
  selectors: string[];
  eventMetadata: Record<string, unknown>;
};

export class RequestedSkillsMetadataReader {
  readRefs = (metadata: Record<string, unknown> | undefined): string[] => {
    if (!metadata) {
      return [];
    }
    return dedupeRequestedSkills(
      readStringList(
        metadata.requested_skill_refs ?? metadata.requestedSkillRefs,
      ),
    );
  };

  readNames = (metadata: Record<string, unknown> | undefined): string[] => {
    if (!metadata) {
      return [];
    }
    return dedupeRequestedSkills(
      readStringList(metadata.requested_skills ?? metadata.requestedSkills),
    );
  };

  readSelectors = (metadata: Record<string, unknown> | undefined): string[] => {
    const refs = this.readRefs(metadata);
    if (refs.length > 0) {
      return refs;
    }
    return this.readNames(metadata);
  };

  readSelection = (
    metadata: Record<string, unknown> | undefined,
  ): RequestedSkillsSelection => {
    const refs = this.readRefs(metadata);
    const names = refs.length > 0 ? [] : this.readNames(metadata);
    return {
      refs,
      names,
      selectors: refs.length > 0 ? refs : names,
      eventMetadata:
        refs.length > 0
          ? { requested_skill_refs: refs }
          : names.length > 0
            ? { requested_skills: names }
            : {},
    };
  };
}
