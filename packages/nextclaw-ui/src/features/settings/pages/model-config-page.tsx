import { Button } from '@/shared/components/ui/button';
import { NavigationLink } from '@/shared/components/actions/navigation-link';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { FormActions } from '@/shared/components/ui/actions/form-actions';
import { SettingRow, SettingsGroup, SettingsSection } from '@/shared/components/settings/setting-row';
import { SettingsPage } from '@/shared/components/settings/settings-page';
import { ProviderScopedModelInput } from '@/shared/components/common/provider-scoped-model-input';
import {
  useConfig,
  useConfigSchema,
  useProviderTemplates,
  useProviders,
  useUpdateModel
} from '@/shared/hooks/use-config';
import { hintForPath } from '@/shared/lib/config-hints';
import { t } from '@/shared/lib/i18n';
import { buildProviderModelCatalog } from '@/shared/lib/provider-models';
import { getDocsUrl } from '@/shared/components/doc-browser/doc-browser-context';
import { BookOpen, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';

const DEFAULT_MODEL_INPUT_PLACEHOLDER = 'provider/model';

function ModelConfigForm(props: {
  initialModel: string;
  initialWorkspace: string;
  isPending: boolean;
  modelHelpText: string;
  modelPlaceholder: string;
  onSubmit: (payload: { model: string; workspace: string }) => void;
  providerCatalog: ReturnType<typeof buildProviderModelCatalog>;
  workspacePlaceholder: string;
}) {
  const {
    initialModel,
    initialWorkspace,
    isPending,
    modelHelpText,
    modelPlaceholder,
    onSubmit,
    providerCatalog,
    workspacePlaceholder
  } = props;
  const [model, setModel] = useState(initialModel);
  const [workspace, setWorkspace] = useState(initialWorkspace);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ model, workspace });
      }}
      className='space-y-5'
    >
      <SettingsSection>
        <SettingsGroup>
          <SettingRow title={t('defaultModel')} description={modelHelpText} layout='stacked'>
            <div className='space-y-2'>
              <Label htmlFor='model' className='sr-only'>{t('defaultModel')}</Label>
              <ProviderScopedModelInput
                id='model'
                value={model}
                onChange={setModel}
                providerCatalog={providerCatalog}
                modelPlaceholder={modelPlaceholder}
              />
              <NavigationLink href={getDocsUrl('/guide/model-selection')} external icon={BookOpen} size='xs'>
                {t('channelsGuideTitle')}
              </NavigationLink>
            </div>
          </SettingRow>
          <SettingRow title={t('workspace')} layout='stacked'>
            <div className='space-y-2'>
              <Label htmlFor='workspace' className='sr-only'>{t('workspace')}</Label>
              <Input
                id='workspace'
                value={workspace}
                onChange={(event) => setWorkspace(event.target.value)}
                placeholder={workspacePlaceholder}
                className='rounded-xl'
              />
            </div>
          </SettingRow>
        </SettingsGroup>
      </SettingsSection>
      <FormActions>
        <Button type='submit' disabled={isPending} size='sm'>
          {isPending ? <Loader2 className='h-3.5 w-3.5 animate-spin' /> : t('saveChanges')}
        </Button>
      </FormActions>
    </form>
  );
}

export function ModelConfigPage() {
  const { data: config, isLoading } = useConfig();
  const { data: providersView } = useProviders();
  const { data: templatesView } = useProviderTemplates();
  const { data: schema } = useConfigSchema();
  const updateModel = useUpdateModel();
  const uiHints = schema?.uiHints;
  const modelHint = hintForPath('agents.defaults.model', uiHints);
  const workspaceHint = hintForPath('agents.defaults.workspace', uiHints);

  const providerCatalog = useMemo(
    () =>
      buildProviderModelCatalog({
        providersView,
        templatesView,
        config,
        onlyConfigured: true
      }),
    [config, providersView, templatesView]
  );
  const modelHelpText = t('modelIdentifierHelp') || modelHint?.help || '';
  const initialModel = (config?.agents?.defaults?.model || '').trim();
  const initialWorkspace = config?.agents?.defaults?.workspace || '';

  if (isLoading) {
    return (
      <SettingsPage title={t('modelPageTitle')} description={t('modelPageDescription')}>
        <div className='divide-y divide-border/55 overflow-hidden rounded-2xl bg-muted/45'>
          <div className='space-y-3 p-4'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-10 w-full rounded-xl' />
          </div>
          <div className='space-y-3 p-4'>
            <Skeleton className='h-5 w-24' />
            <Skeleton className='h-10 w-full rounded-xl' />
          </div>
        </div>
      </SettingsPage>
    );
  }

  return (
    <SettingsPage title={t('modelPageTitle')} description={t('modelPageDescription')}>
      <ModelConfigForm
        key={`${initialModel}::${initialWorkspace}`}
        initialModel={initialModel}
        initialWorkspace={initialWorkspace}
        isPending={updateModel.isPending}
        modelHelpText={modelHelpText}
        modelPlaceholder={modelHint?.placeholder ?? DEFAULT_MODEL_INPUT_PLACEHOLDER}
        onSubmit={({ model, workspace }) =>
          updateModel.mutate({
            model,
            workspace
          })
        }
        providerCatalog={providerCatalog}
        workspacePlaceholder={workspaceHint?.placeholder ?? '/path/to/workspace'}
      />
    </SettingsPage>
  );
}
