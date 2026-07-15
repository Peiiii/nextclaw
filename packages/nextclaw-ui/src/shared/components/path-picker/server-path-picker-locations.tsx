import {
  AppWindow,
  Cloud,
  Download,
  FileText,
  FolderKanban,
  HardDrive,
  Home,
  Monitor,
  Star,
} from 'lucide-react';
import type { ServerPathLocationView } from '@/shared/lib/api';
import { cn } from '@/shared/lib/utils';
import { t } from '@/shared/lib/i18n';

type ServerPathPickerLocationItem = {
  icon: 'applications' | 'desktop' | 'documents' | 'downloads' | 'home' | 'icloud-drive' | 'root' | 'volumes' | 'workspace';
  label: string;
  path: string;
};

type ServerPathPickerLocationsProps = {
  currentPath: string;
  defaultWorkspacePath?: string | null;
  disabled: boolean;
  homePath?: string | null;
  locations: readonly ServerPathLocationView[];
  rootPath?: string | null;
  onNavigate: (path: string) => void;
};

const locationIcons = {
  applications: AppWindow,
  desktop: Monitor,
  documents: FileText,
  downloads: Download,
  home: Home,
  'icloud-drive': Cloud,
  workspace: FolderKanban,
  root: HardDrive,
  volumes: HardDrive,
};

const locationLabelKeys: Record<ServerPathLocationView['kind'], string> = {
  applications: 'pathPickerApplications',
  desktop: 'pathPickerDesktop',
  documents: 'pathPickerDocuments',
  downloads: 'pathPickerDownloads',
  'icloud-drive': 'pathPickerICloudDrive',
  volumes: 'pathPickerVolumes',
};

export function ServerPathPickerLocations({
  currentPath,
  defaultWorkspacePath,
  disabled,
  homePath,
  locations,
  rootPath,
  onNavigate,
}: ServerPathPickerLocationsProps) {
  const favoriteItems: ServerPathPickerLocationItem[] = [];
  const locationItems: ServerPathPickerLocationItem[] = [];
  const knownPaths = new Set<string>();
  const appendLocation = (
    target: ServerPathPickerLocationItem[],
    item: ServerPathPickerLocationItem,
  ) => {
    const path = item.path.trim();
    if (!path || knownPaths.has(path)) {
      return;
    }
    knownPaths.add(path);
    target.push({ ...item, path });
  };

  if (defaultWorkspacePath) {
    appendLocation(favoriteItems, {
      icon: 'workspace',
      label: t('pathPickerDefaultWorkspace'),
      path: defaultWorkspacePath,
    });
  }
  if (homePath) {
    appendLocation(favoriteItems, {
      icon: 'home',
      label: t('homeDirectory'),
      path: homePath,
    });
  }
  for (const location of locations) {
    appendLocation(location.kind === 'volumes' ? locationItems : favoriteItems, {
      icon: location.kind,
      label: t(locationLabelKeys[location.kind]),
      path: location.path,
    });
  }
  if (rootPath) {
    appendLocation(locationItems, {
      icon: 'root',
      label: t('pathPickerFileSystem'),
      path: rootPath,
    });
  }

  const renderItems = (items: ServerPathPickerLocationItem[]) => items.map((item) => {
    const Icon = locationIcons[item.icon];
    const active = currentPath === item.path;
    return (
      <button
        key={item.path}
        type="button"
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border',
          active ? 'bg-primary/12 text-primary' : 'text-foreground hover:bg-accent',
        )}
        aria-current={active ? 'location' : undefined}
        onClick={() => onNavigate(item.path)}
        disabled={disabled}
      >
        <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-amber-500')} />
        <span className="truncate">{item.label}</span>
      </button>
    );
  });

  return (
    <aside className="hidden min-h-0 w-48 shrink-0 overflow-y-auto border-r border-border bg-muted/20 p-2 sm:block">
      <div className="mb-1 flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
        <Star className="h-3.5 w-3.5" />
        {t('pathPickerQuickAccess')}
      </div>
      <nav aria-label={t('pathPickerQuickAccess')} className="space-y-0.5">
        {renderItems(favoriteItems)}
      </nav>
      {locationItems.length > 0 ? (
        <>
          <div className="mb-1 mt-3 px-2 py-1.5 text-xs font-medium text-muted-foreground">
            {t('pathPickerLocations')}
          </div>
          <nav aria-label={t('pathPickerLocations')} className="space-y-0.5">
            {renderItems(locationItems)}
          </nav>
        </>
      ) : null}
    </aside>
  );
}
