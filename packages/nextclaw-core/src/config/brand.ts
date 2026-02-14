export const ENV_APP_NAME_KEY = "NEXTCLAW_APP_NAME";
const envAppName = process.env[ENV_APP_NAME_KEY]?.trim();
export const APP_NAME = envAppName && envAppName.length > 0 ? envAppName : "nextclaw";
export const APP_TAGLINE = "Personal AI Assistant";
export const APP_TITLE = `${APP_NAME.slice(0, 1).toUpperCase()}${APP_NAME.slice(1)}`;

export const ENV_HOME_KEY = "NEXTCLAW_HOME";
export const DEFAULT_HOME_DIR = ".nextclaw";
export const DEFAULT_CONFIG_FILE = "config.json";
export const DEFAULT_WORKSPACE_DIR = "workspace";
export const DEFAULT_CONFIG_PATH = `~/${DEFAULT_HOME_DIR}/${DEFAULT_CONFIG_FILE}`;
export const DEFAULT_WORKSPACE_PATH = `~/${DEFAULT_HOME_DIR}/${DEFAULT_WORKSPACE_DIR}`;

export const APP_USER_AGENT = APP_NAME;
export const APP_REPLY_SUBJECT = `${APP_NAME} reply`;
export const SKILL_METADATA_KEY = "nextclaw";
