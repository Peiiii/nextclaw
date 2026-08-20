import type { NcpDraftAttachment } from "@nextclaw/ncp-react";

import { API_BASE } from "@/shared/lib/api/api-base";
import { nextclawClient } from "@/shared/lib/api/managers/client.manager";

export function buildNcpAssetContentUrl(assetUri: string): string {
  const query = new URLSearchParams({ uri: assetUri });
  return `${API_BASE}/api/ncp/assets/content?${query.toString()}`;
}

export async function uploadNcpAssets(files: File[]): Promise<NcpDraftAttachment[]> {
  const payload = await nextclawClient.sessions.uploadAssets(files);
  return payload.assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    assetUri: asset.assetUri,
    url: asset.url,
  }));
}
