import type { ChatInputSurfaceItem } from '@nextclaw/agent-chat-ui';
import {
  CHAT_PROJECT_TOKEN_KIND,
  CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
  CHAT_WORKSPACE_FILE_TOKEN_KIND,
} from '@nextclaw/shared';
import type { ProjectView, ServerPathSearchEntryView } from '@/shared/lib/api';
import type { ContextReferenceLocation } from './chat-input-product-plugin-adapters.types';
import {
  resolveInputSurfaceMatchTier,
  scoreInputSurfaceSearchCandidate,
} from './input-surface-search.utils';

export const FILES_NAVIGATION_ITEM_KEY = 'context-reference:navigate:files';
export const PROJECTS_NAVIGATION_ITEM_KEY = 'context-reference:navigate:projects';
export const ROOT_NAVIGATION_ITEM_KEY = 'context-reference:navigate:root';

const WORKSPACE_SECTION_KEY = 'workspace';
const PROJECT_SECTION_KEY = 'projects';

export type ContextReferenceInputSurfaceTexts = {
  backLabel: string;
  backDescription: string;
  backHintLabel: string;
  currentDirectoryLabel: string;
  directoryDescription: string;
  fileDescription: string;
  filesDescription: string;
  filesHintLabel: string;
  filesLabel: string;
  filesSubtitle: string;
  panelAppSectionLabel: string;
  parentLabel: string;
  parentDescription: string;
  parentHintLabel: string;
  projectDescription: string;
  projectPathLabel: string;
  projectSectionLabel: string;
  projectSubtitle: string;
  projectsDescription: string;
  projectsHintLabel: string;
  projectsLabel: string;
  projectsLoadFailedLabel: string;
  projectsSubtitle: string;
  projectRootLabel: string;
  searchFailedLabel: string;
  workspaceSectionLabel: string;
};

function resolveProjectLabel(projectRoot: string): string {
  return projectRoot.split(/[\\/]+/).filter(Boolean).at(-1) ?? projectRoot;
}

function buildPathPreview(params: {
  kind: 'directory' | 'file';
  projectRoot: string;
  relativePath: string;
}) {
  const { kind, projectRoot, relativePath } = params;
  const pathSegments = relativePath.split('/').filter(Boolean);
  return {
    rootLabel: resolveProjectLabel(projectRoot),
    segments: pathSegments.map((label, index) => ({
      label,
      kind: index === pathSegments.length - 1 ? kind : 'directory' as const,
    })),
  };
}

export function buildProjectReferenceItems(params: {
  projects: readonly ProjectView[];
  query: string;
  texts: ContextReferenceInputSurfaceTexts;
}): ChatInputSurfaceItem[] {
  const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
  return params.projects
    .map((project, order) => ({
      order,
      project,
      score: scoreInputSurfaceSearchCandidate(
        {
          id: project.rootPath,
          label: project.name,
          description: project.rootPath,
          aliases: project.template ? [project.template] : [],
        },
        params.query,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => {
      const leftTier = resolveInputSurfaceMatchTier(left.score);
      const rightTier = resolveInputSurfaceMatchTier(right.score);
      if (rightTier !== leftTier) {
        return rightTier - leftTier;
      }
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return collator.compare(left.project.name, right.project.name) || left.order - right.order;
    })
    .map(({ project }) => ({
      key: `context-reference:project:${project.rootPath}`,
      icon: 'project',
      title: project.name,
      subtitle: params.texts.projectSubtitle,
      description: params.texts.projectDescription,
      detailLines: [`${params.texts.projectPathLabel}: ${project.rootPath}`],
      sectionKey: PROJECT_SECTION_KEY,
      sectionLabel: params.texts.projectSectionLabel,
      value: project.rootPath,
      tokenKind: CHAT_PROJECT_TOKEN_KIND,
      tokenKey: project.rootPath,
    }));
}

export function buildWorkspaceReferenceItems(params: {
  entries: readonly ServerPathSearchEntryView[];
  navigateDirectories: boolean;
  projectRoot: string;
  texts: ContextReferenceInputSurfaceTexts;
}): ChatInputSurfaceItem[] {
  const projectLabel = resolveProjectLabel(params.projectRoot);
  return params.entries.map((entry) => {
    const navigates = params.navigateDirectories && entry.kind === 'directory';
    return {
      key: `workspace:${entry.kind}:${entry.relativePath}`,
      icon: entry.kind === 'directory' ? 'folder' : 'file',
      title: entry.name,
      subtitle: entry.parentRelativePath || projectLabel,
      description: entry.kind === 'directory'
        ? params.texts.directoryDescription
        : params.texts.fileDescription,
      detailLines: [
        `${params.texts.projectRootLabel}: ${params.projectRoot}`,
        entry.relativePath,
      ],
      sectionKey: WORKSPACE_SECTION_KEY,
      sectionLabel: params.texts.workspaceSectionLabel,
      value: entry.relativePath,
      tokenKind: navigates
        ? undefined
        : entry.kind === 'directory'
          ? CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND
          : CHAT_WORKSPACE_FILE_TOKEN_KIND,
      tokenKey: navigates ? undefined : entry.relativePath,
      selectionBehavior: navigates ? 'navigate' : undefined,
      pathPreview: buildPathPreview({
        kind: entry.kind,
        projectRoot: params.projectRoot,
        relativePath: entry.relativePath,
      }),
    } satisfies ChatInputSurfaceItem;
  });
}

export function buildCurrentDirectoryReferenceItem(params: {
  projectRoot: string;
  referencePath: string;
  texts: ContextReferenceInputSurfaceTexts;
}): ChatInputSurfaceItem {
  const { projectRoot, referencePath, texts } = params;
  const title = referencePath.split('/').filter(Boolean).at(-1) ?? referencePath;
  return {
    key: `context-reference:current-directory:${referencePath}`,
    icon: 'folder',
    title: texts.currentDirectoryLabel,
    subtitle: title,
    description: texts.directoryDescription,
    detailLines: [
      `${texts.projectRootLabel}: ${projectRoot}`,
      referencePath,
    ],
    sectionKey: WORKSPACE_SECTION_KEY,
    sectionLabel: texts.workspaceSectionLabel,
    value: referencePath,
    tokenKind: CHAT_WORKSPACE_DIRECTORY_TOKEN_KIND,
    tokenKey: referencePath,
    pathPreview: buildPathPreview({
      kind: 'directory',
      projectRoot,
      relativePath: referencePath,
    }),
  };
}

export function buildFilesNavigationItem(
  texts: ContextReferenceInputSurfaceTexts,
): ChatInputSurfaceItem {
  return {
    key: FILES_NAVIGATION_ITEM_KEY,
    icon: 'files',
    title: texts.filesLabel,
    subtitle: texts.filesSubtitle,
    description: texts.filesDescription,
    detailLines: [],
    hintLabel: texts.filesHintLabel,
    selectionBehavior: 'navigate',
  };
}

export function buildProjectsNavigationItem(
  texts: ContextReferenceInputSurfaceTexts,
): ChatInputSurfaceItem {
  return {
    key: PROJECTS_NAVIGATION_ITEM_KEY,
    icon: 'project',
    title: texts.projectsLabel,
    subtitle: texts.projectsSubtitle,
    description: texts.projectsDescription,
    detailLines: [],
    hintLabel: texts.projectsHintLabel,
    selectionBehavior: 'navigate',
  };
}

function resolveParentReferencePath(referencePath: string): string | null {
  const segments = referencePath.split('/').filter(Boolean);
  return segments.length === 0 ? null : segments.slice(0, -1).join('/');
}

export function buildBackNavigationItem(params: {
  location: ContextReferenceLocation;
  texts: ContextReferenceInputSurfaceTexts;
}): ChatInputSurfaceItem {
  const { location, texts } = params;
  const referencePath = location.view === 'files' ? location.path : '';
  const isRootView = location.view !== 'files' || !referencePath;
  return {
    key: ROOT_NAVIGATION_ITEM_KEY,
    icon: 'back',
    title: isRootView ? texts.backLabel : texts.parentLabel,
    subtitle: '',
    description: isRootView ? texts.backDescription : texts.parentDescription,
    detailLines: [],
    hintLabel: isRootView ? texts.backHintLabel : texts.parentHintLabel,
    value: resolveParentReferencePath(referencePath) ?? '',
    selectionBehavior: 'navigate',
  };
}
