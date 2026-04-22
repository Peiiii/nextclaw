import type { NcpDraftAttachment } from "@nextclaw/ncp-react";
import { API_BASE } from "./api-base";
import type { ApiResponse, NcpAssetPutView } from "./types";

function readErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return fallback;
  }
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return fallback;
  }
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && message.trim().length > 0 ? message : fallback;
}

export async function uploadNcpAssets(files: File[]): Promise<NcpDraftAttachment[]> {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const response = await fetch(`${API_BASE}/api/ncp/assets`, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const payload = (await response.json()) as ApiResponse<NcpAssetPutView>;
  if (!response.ok || !payload.ok) {
    throw new Error(readErrorMessage(payload, "Failed to put assets."));
  }

  return payload.data.assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    assetUri: asset.assetUri,
    url: asset.url,
  }));
}
