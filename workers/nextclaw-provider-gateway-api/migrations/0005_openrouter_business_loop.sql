PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS provider_accounts (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  display_name TEXT,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('oauth', 'api_key')),
  api_base TEXT NOT NULL,
  access_token TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  priority INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_accounts_provider ON provider_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_provider_accounts_enabled_priority ON provider_accounts(enabled, priority ASC, created_at ASC);

CREATE TABLE IF NOT EXISTS model_catalog (
  public_model_id TEXT PRIMARY KEY,
  provider_account_id TEXT NOT NULL,
  upstream_model TEXT NOT NULL,
  display_name TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sell_input_usd_per_1m REAL NOT NULL CHECK (sell_input_usd_per_1m >= 0),
  sell_output_usd_per_1m REAL NOT NULL CHECK (sell_output_usd_per_1m >= 0),
  upstream_input_usd_per_1m REAL NOT NULL CHECK (upstream_input_usd_per_1m >= 0),
  upstream_output_usd_per_1m REAL NOT NULL CHECK (upstream_output_usd_per_1m >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (provider_account_id) REFERENCES provider_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_model_catalog_enabled ON model_catalog(enabled, public_model_id);
CREATE INDEX IF NOT EXISTS idx_model_catalog_provider ON model_catalog(provider_account_id);

CREATE TABLE IF NOT EXISTS request_profit_ledger (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  public_model_id TEXT NOT NULL,
  provider_account_id TEXT,
  upstream_model TEXT NOT NULL,
  charge_usd REAL NOT NULL,
  upstream_cost_usd REAL NOT NULL,
  gross_margin_usd REAL NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (provider_account_id) REFERENCES provider_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_request_profit_ledger_created_at ON request_profit_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_profit_ledger_user_created_at ON request_profit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_profit_ledger_model_created_at ON request_profit_ledger(public_model_id, created_at DESC);
