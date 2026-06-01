import { describe, expect, it } from 'vitest';
import { ResourceUriResolver } from '@/shared/lib/resource-uri';
import type { ResourceUriRouteDefinition } from '@/shared/lib/resource-uri';

type TestTarget = {
  normalizedUri: string;
  type: 'nextclaw' | 'external';
};

const routeDefinitions: ResourceUriRouteDefinition<TestTarget>[] = [
  {
    id: 'nextclaw',
    match: (uri) => uri.scheme === 'nextclaw',
    resolve: (uri) => ({
      normalizedUri: `nextclaw://${uri.authority}${uri.pathname}`,
      type: 'nextclaw',
    }),
  },
  {
    id: 'external',
    match: (uri) => uri.scheme === 'https',
    resolve: (uri) => ({
      normalizedUri: uri.raw,
      type: 'external',
    }),
  },
];

describe('ResourceUriResolver', () => {
  it('resolves URI targets through registered route definitions', () => {
    const resolver = new ResourceUriResolver(routeDefinitions, {
      getNormalizedUri: (target) => target.normalizedUri,
    });

    expect(resolver.resolve('nextclaw://apps')).toEqual({
      normalizedUri: 'nextclaw://apps',
      type: 'nextclaw',
    });
  });

  it('compares targets by normalized URI by default', () => {
    const resolver = new ResourceUriResolver(routeDefinitions, {
      getNormalizedUri: (target) => target.normalizedUri,
    });

    expect(resolver.areEquivalent('nextclaw://apps', 'nextclaw://apps')).toBe(true);
    expect(resolver.areEquivalent('nextclaw://apps', 'nextclaw://docs')).toBe(false);
  });
});
