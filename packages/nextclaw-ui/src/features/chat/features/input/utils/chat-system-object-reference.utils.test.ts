import { describe, expect, it } from 'vitest';
import { CHAT_SYSTEM_OBJECT_TOKEN_KIND, type SystemObjectResolvedReference } from '@nextclaw/shared';
import {
  appendSystemObjectReferenceToken,
  readSystemObjectReferenceFromToken,
} from './chat-system-object-reference.utils';

const reference: SystemObjectResolvedReference = {
  uri: 'nextclaw://objects/cron-job/cron-1',
  objectType: 'cron-job',
  objectId: 'cron-1',
  label: 'Daily review',
  description: 'Review reports',
  updatedAt: '2026-08-11T00:00:00.000Z',
  version: 'a'.repeat(64),
  assetUri: 'asset://store/cron-1',
  fileName: 'daily-review.md',
  mimeType: 'text/markdown',
  sizeBytes: 42,
};

describe('system object reference composer utilities', () => {
  it('creates one visible generic token and deduplicates the same snapshot', () => {
    const first = appendSystemObjectReferenceToken([], reference);
    const second = appendSystemObjectReferenceToken(first, reference);

    expect(second).toHaveLength(first.length);
    expect(second.find((node) => node.type === 'token')).toMatchObject({
      tokenKind: CHAT_SYSTEM_OBJECT_TOKEN_KIND,
      tokenKey: reference.uri,
      label: reference.label,
    });
    expect(readSystemObjectReferenceFromToken(second[0]!)).toEqual(reference);
  });

  it('rejects metadata whose URI identity disagrees with its object fields', () => {
    const [node] = appendSystemObjectReferenceToken([], {
      ...reference,
      objectId: 'different-cron',
    });

    expect(readSystemObjectReferenceFromToken(node!)).toBeNull();
  });
});
