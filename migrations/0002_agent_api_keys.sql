-- Agent API keys — per-user tokens for the Agent Bridge (/api/agent/*)
-- Only the sha256 hash of the secret is stored; the full token is shown once
-- at creation (mm_<prefix>_<secret>). Revoking sets revoked_at.

CREATE TABLE IF NOT EXISTS agent_api_keys (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_prefix varchar NOT NULL,
  token_hash varchar NOT NULL UNIQUE,
  scopes text NOT NULL DEFAULT 'read,write',
  last_used_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  revoked_at timestamp
);

CREATE INDEX IF NOT EXISTS IDX_agent_api_keys_user ON agent_api_keys(user_id);
CREATE INDEX IF NOT EXISTS IDX_agent_api_keys_hash ON agent_api_keys(token_hash);
