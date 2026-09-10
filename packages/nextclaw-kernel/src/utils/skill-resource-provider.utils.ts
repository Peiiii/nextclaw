import { join } from "node:path";
import type { ProjectManager } from "@kernel/features/projects/index.js";
import type { ProjectMaterialService } from "@kernel/features/projects/index.js";
import { readFileSync, statSync } from "node:fs";
import {
  createSystemObjectReferenceUri,
  type SystemObjectReferenceItem,
} from "@nextclaw/shared";
import type {
  SkillManager,
  SkillInfo,
} from "@kernel/managers/skill.manager.js";
import type { SystemObjectReferenceProvider } from "@kernel/managers/system-object-reference.manager.js";

/** Installed skill identity uses the loader's exact ref, not an ambiguous display name. */
export function createSkillResourceProvider(
  skills: SkillManager,
  projectCatalog?: {
    projects: ProjectManager;
    materials: ProjectMaterialService;
  },
): SystemObjectReferenceProvider {
  const toItem = (
    skill: Pick<SkillInfo, "ref" | "name" | "path">,
  ): SystemObjectReferenceItem => ({
    uri: createSystemObjectReferenceUri("skill", skill.ref),
    objectType: "skill",
    objectId: skill.ref,
    label: skill.name,
    description: null,
    updatedAt: statSync(skill.path).mtime.toISOString(),
  });
  const catalog = async () => {
    const entries = new Map<string, Pick<SkillInfo, "ref" | "name" | "path">>(
      skills
        .listSkills({ filterUnavailable: false })
        .map((skill) => [skill.ref, skill]),
    );
    if (projectCatalog) {
      for (const project of await projectCatalog.projects.listProjects()) {
        for (const skill of await projectCatalog.materials.listSkills(
          project.id,
        )) {
          entries.set(skill.ref, {
            ...skill,
            path: join(project.rootPath, skill.path),
          });
        }
      }
    }
    return [...entries.values()];
  };
  return {
    group: {
      objectType: "skill",
      label: { default: "Skills", translations: { en: "Skills", zh: "技能" } },
      description: {
        default: "Reference an installed skill and its source.",
        translations: { zh: "引用已安装技能及其来源。" },
      },
      icon: "skill",
      order: 300,
    },
    list: async () =>
      (await catalog()).flatMap((skill) => {
        try {
          return [toItem(skill)];
        } catch {
          return [];
        }
      }),
    resolve: async (ref) => {
      const skill = (await catalog()).find((entry) => entry.ref === ref);
      if (!skill || skill.ref !== ref) return null;
      return {
        item: toItem(skill),
        content: readFileSync(skill.path, "utf8"),
        fileName: "SKILL.md",
        mimeType: "text/markdown",
      };
    },
  };
}
