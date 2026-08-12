export type ServerPathEntryView = {
  name: string;
  path: string;
  kind: 'directory' | 'file';
  hidden: boolean;
};

export type ServerPathBreadcrumbView = { label: string; path: string };

export type ServerPathLocationView = {
  kind: 'desktop' | 'documents' | 'downloads' | 'icloud-drive' | 'applications' | 'volumes';
  path: string;
};

export type ServerPathBrowseView = {
  currentPath: string;
  parentPath: string | null;
  homePath: string;
  breadcrumbs: ServerPathBreadcrumbView[];
  entries: ServerPathEntryView[];
  locations: ServerPathLocationView[];
};

export type ServerPathWatchRequest = {
  subscriptionId?: string | null;
  directories: string[];
};

export type ServerPathWatchView = {
  subscriptionId: string;
  watchedDirectories: string[];
};

export type ServerPathSearchEntryView = {
  name: string;
  path: string;
  relativePath: string;
  parentRelativePath: string;
  kind: 'directory' | 'file';
  hidden: boolean;
};

export type ServerPathSearchView = {
  basePath: string;
  query: string;
  entries: ServerPathSearchEntryView[];
  truncated: boolean;
};

export type ServerPathDirectoryCreateRequest = { basePath?: string; parentPath: string; name: string };
export type ServerPathDirectoryCreateView = { path: string };
export type ServerPathFileCreateRequest = { basePath: string; parentPath: string; name: string };
export type ServerPathFileCreateView = { name: string; path: string; kind: 'file' };
export type ServerPathEntryRenameRequest = { basePath: string; path: string; name: string };
export type ServerPathEntryRenameView = {
  oldPath: string;
  path: string;
  name: string;
  kind: 'directory' | 'file';
};
export type ServerPathEntryDeleteView = { path: string; kind: 'directory' | 'file' };
export type ServerPathFilesUploadView = {
  files: Array<{ name: string; path: string; sizeBytes: number }>;
  overwritten: boolean;
};

export type ServerPathReadView = {
  requestedPath: string;
  resolvedPath: string;
  kind: 'text' | 'markdown' | 'binary';
  sizeBytes: number;
  startLine?: number;
  truncated: boolean;
  text?: string;
  languageHint?: string | null;
};
