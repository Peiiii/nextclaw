import { DEFAULT_NCP_ATTACHMENT_MAX_BYTES, uploadFilesAsNcpDraftAttachments } from '@nextclaw/ncp-react';
import { describe, expect, it, vi } from 'vitest';

describe('ncp attachment upload limit', () => {
  it('accepts files larger than the previous 10MB cap', async () => {
    expect(DEFAULT_NCP_ATTACHMENT_MAX_BYTES).toBe(200 * 1024 * 1024);

    const file = new File([new Uint8Array(12 * 1024 * 1024)], 'large-image.png', {
      type: 'image/png'
    });
    const uploadBatch = vi.fn(async (files: File[]) =>
      files.map((entry) => ({
        id: entry.name,
        name: entry.name,
        mimeType: entry.type,
        sizeBytes: entry.size,
        assetUri: `asset://store/${entry.name}`,
      }))
    );

    const result = await uploadFilesAsNcpDraftAttachments([file], {
      uploadBatch
    });

    expect(result.rejected).toEqual([]);
    expect(uploadBatch).toHaveBeenCalledOnce();
    expect(uploadBatch).toHaveBeenCalledWith([file]);
    expect(result.attachments).toEqual([
      {
        id: 'large-image.png',
        name: 'large-image.png',
        mimeType: 'image/png',
        sizeBytes: 12 * 1024 * 1024,
        assetUri: 'asset://store/large-image.png',
      }
    ]);
  });
});
