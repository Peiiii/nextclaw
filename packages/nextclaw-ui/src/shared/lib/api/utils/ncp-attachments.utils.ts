import type { NcpDraftAttachment } from "@nextclaw/ncp-react";
import { nextclawClient } from "../managers/client.manager";

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
