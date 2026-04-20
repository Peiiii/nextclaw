import { describe, expect, it } from 'vitest';
import { buildChannelFormDefinitions } from './channel-form-fields.utils';

describe('buildChannelFormDefinitions', () => {
  it('keeps default channels on a single all-fields layout', () => {
    const definitions = buildChannelFormDefinitions();

    expect(definitions.telegram?.layout).toBeUndefined();
    expect(definitions.telegram?.fields.some((field) => field.name === 'enabled')).toBe(true);
  });

  it('declares weixin layout blocks instead of relying on form-level branching', () => {
    const definitions = buildChannelFormDefinitions();

    expect(definitions.weixin?.layout).toEqual([
      { type: 'fields', section: 'primary' },
      { type: 'custom', sectionId: 'weixin-auth' },
      {
        type: 'fields',
        section: 'advanced',
        collapsible: {
          title: 'Advanced settings',
          description: 'Expand these fields only when you need to customize the API base URL, account mapping, or allowlist.'
        }
      }
    ]);
  });
});
