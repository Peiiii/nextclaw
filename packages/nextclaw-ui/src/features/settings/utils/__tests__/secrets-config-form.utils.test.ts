import { describe, expect, it } from 'vitest';
import {
  buildSecretsFormState,
  buildSecretsSubmitPayload,
  createProviderRow,
  createRefRow,
  prepareSecretsFormSubmitState,
  type SecretsFormState,
} from '@/features/settings/utils/secrets-config-form.utils';

function createState(patch: Partial<SecretsFormState> = {}): SecretsFormState {
  return {
    enabled: true,
    defaultEnv: '',
    defaultFile: '',
    defaultExec: '',
    providers: [],
    refs: [],
    ...patch,
  };
}

describe('secrets config form utils', () => {
  it('round-trips loaded secrets config into a submit payload', () => {
    const state = buildSecretsFormState({
      enabled: true,
      defaults: { env: 'vault-env', file: 'vault-file' },
      providers: {
        'vault-env': { source: 'env', prefix: 'NEXTCLAW_' },
        'vault-file': { source: 'file', path: '/tmp/secrets.json', format: 'json' },
      },
      refs: {
        'agents.defaults.model': { source: 'env', provider: 'vault-env', id: 'DEFAULT_MODEL' },
      },
    });

    expect(buildSecretsSubmitPayload(prepareSecretsFormSubmitState(state))).toEqual({
      enabled: true,
      defaults: { env: 'vault-env', file: 'vault-file', exec: null },
      providers: {
        'vault-env': { source: 'env', prefix: 'NEXTCLAW_' },
        'vault-file': { source: 'file', path: '/tmp/secrets.json', format: 'json' },
      },
      refs: {
        'agents.defaults.model': { source: 'env', provider: 'vault-env', id: 'DEFAULT_MODEL' },
      },
    });
  });

  it('rejects duplicate provider aliases before submit', () => {
    const state = createState({
      providers: [createProviderRow('vault'), createProviderRow(' vault ')],
    });

    expect(() => prepareSecretsFormSubmitState(state)).toThrow('vault');
  });

  it('rejects refs that point at an unknown provider', () => {
    const state = createState({
      providers: [createProviderRow('vault-env')],
      refs: [{ ...createRefRow(), path: 'agents.defaults.model', id: 'DEFAULT_MODEL', provider: 'missing' }],
    });

    expect(() => prepareSecretsFormSubmitState(state)).toThrow('missing');
  });
});
