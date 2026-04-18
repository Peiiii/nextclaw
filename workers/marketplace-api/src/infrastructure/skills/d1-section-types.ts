import type { LocalizedTextMap } from "../../domain/model";

export type ItemRow = {
  id: string;
  slug: string;
  package_name?: string | null;
  owner_scope?: string | null;
  skill_name?: string | null;
  publish_status?: string | null;
  published_by_type?: string | null;
  review_note?: string | null;
  reviewed_at?: string | null;
  name: string;
  summary: string;
  summary_i18n: string;
  description: string | null;
  description_i18n: string | null;
  tags: string;
  author: string;
  source_repo: string | null;
  homepage: string | null;
  install_kind: string;
  install_spec: string;
  install_command: string;
  published_at: string;
  updated_at: string;
};

export type SceneRow = {
  scene_id: string;
  title: string;
  description: string | null;
  item_id: string | null;
};

export type SkillFileRow = {
  file_path: string;
  content_b64: string;
  content_sha256: string;
  updated_at: string;
  storage_backend: string | null;
  r2_key: string | null;
  size_bytes: number | null;
};

export type TableNames = {
  items: string;
  scenes: string;
  sceneItems: string;
};

export type MarketplaceSkillFile = {
  path: string;
  sha256: string;
  sizeBytes: number;
  updatedAt: string;
  downloadPath?: string;
};

export type MarketplaceSkillUpsertInput = {
  id?: string;
  slug?: string;
  packageName?: string;
  requireExisting?: boolean;
  name: string;
  summary: string;
  summaryI18n?: LocalizedTextMap;
  description?: string;
  descriptionI18n?: LocalizedTextMap;
  tags?: string[];
  sourceRepo?: string;
  homepage?: string;
  files: Array<{
    path: string;
    contentBase64: string;
  }>;
  publishedAt?: string;
  updatedAt?: string;
};

export type MarketplaceSkillPublishActor = {
  authType: "admin_token" | "platform_user";
  role: "admin" | "user";
  userId: string | null;
  username: string | null;
};
