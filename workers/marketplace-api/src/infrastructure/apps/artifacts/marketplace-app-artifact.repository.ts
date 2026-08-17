import type { MarketplaceAppArtifactRow } from "../app-marketplace.types";

const ARTIFACT_COLUMNS = `
  item_id,
  version,
  target_key,
  target_json,
  bundle_sha256,
  size_bytes,
  bundle_storage_key,
  status,
  created_at,
  updated_at
`;

export class MarketplaceAppArtifactRepository {
  constructor(private readonly db: D1Database) {}

  listRows = async (itemId: string): Promise<MarketplaceAppArtifactRow[]> => {
    const result = await this.db.prepare(
      `
        SELECT ${ARTIFACT_COLUMNS}
        FROM marketplace_app_artifacts
        WHERE item_id = ?
        ORDER BY version DESC, target_key ASC
      `,
    ).bind(itemId).all<MarketplaceAppArtifactRow>();
    return result.results ?? [];
  };

  getActiveRow = async (params: {
    itemId: string;
    version: string;
    targetKey: string;
  }): Promise<MarketplaceAppArtifactRow | null> => (
    (await this.db.prepare(
      `
        SELECT ${ARTIFACT_COLUMNS}
        FROM marketplace_app_artifacts
        WHERE item_id = ? AND version = ? AND target_key = ? AND status = 'active'
        LIMIT 1
      `,
    ).bind(
      params.itemId,
      params.version,
      params.targetKey,
    ).first<MarketplaceAppArtifactRow>()) ?? null
  );
}
