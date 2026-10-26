-- RPC-SAGA-GOVERNANCE (#875): permission catalogs, grants, bundles, asset binding reveal.

CREATE TABLE IF NOT EXISTS saga_permission_keys (
  key TEXT NOT NULL PRIMARY KEY,
  area TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS saga_permission_bundles (
  id TEXT NOT NULL PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS saga_permission_bundle_keys (
  bundle_id TEXT NOT NULL REFERENCES saga_permission_bundles (id),
  permission_key TEXT NOT NULL REFERENCES saga_permission_keys (key),
  PRIMARY KEY (bundle_id, permission_key)
) STRICT;

CREATE TABLE IF NOT EXISTS project_member_saga_grants (
  project_id TEXT NOT NULL REFERENCES projects (id),
  member_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  permission_key TEXT NOT NULL REFERENCES saga_permission_keys (key),
  source_bundle_id TEXT,
  granted_by TEXT,
  PRIMARY KEY (member_id, permission_key)
) STRICT;

CREATE INDEX IF NOT EXISTS project_member_saga_grants_project_user_idx
  ON project_member_saga_grants (project_id, user_id);

CREATE TABLE IF NOT EXISTS project_member_saga_bundles (
  member_id TEXT NOT NULL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  user_id TEXT NOT NULL,
  bundle_id TEXT NOT NULL REFERENCES saga_permission_bundles (id),
  assigned_by TEXT,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS saga_asset_bindings (
  id TEXT NOT NULL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects (id),
  asset_kind TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  reveal TEXT NOT NULL CHECK (reveal IN ('gm_only', 'party', 'unlisted')),
  label TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  world_place_id TEXT,
  updated_at TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS saga_asset_bindings_project_idx
  ON saga_asset_bindings (project_id, asset_kind);

-- Catalog seed (mirrors 075_saga_permission_grants.sql allow-lists).
INSERT OR IGNORE INTO saga_permission_keys (key, area, action, description) VALUES
  ('saga.workspace.access', 'workspace', 'access', 'Open saga workspace'),
  ('saga.characters.read', 'characters', 'read', 'See party PCs'),
  ('saga.characters.create', 'characters', 'create', 'Create PC'),
  ('saga.characters.update_own', 'characters', 'update_own', 'Edit own PC'),
  ('saga.characters.update_any', 'characters', 'update_any', 'Edit any PC'),
  ('saga.characters.assign', 'characters', 'assign', 'Bind/unbind PC'),
  ('saga.world.read', 'world', 'read', 'Maps / locations / lore read'),
  ('saga.world.update', 'world', 'update', 'Edit world content'),
  ('saga.npc.read', 'npc', 'read', 'See party-revealed NSCs'),
  ('saga.npc.read_hidden', 'npc', 'read_hidden', 'See gm_only NSCs'),
  ('saga.npc.create', 'npc', 'create', 'Create NSC'),
  ('saga.npc.update', 'npc', 'update', 'Update NSC'),
  ('saga.npc.delete', 'npc', 'delete', 'Delete NSC'),
  ('saga.items.read', 'items', 'read', 'See party-revealed items'),
  ('saga.items.read_hidden', 'items', 'read_hidden', 'See gm_only items'),
  ('saga.items.create', 'items', 'create', 'Create item'),
  ('saga.items.update', 'items', 'update', 'Update item'),
  ('saga.items.delete', 'items', 'delete', 'Delete item'),
  ('saga.quests.read', 'quests', 'read', 'See party-revealed quests'),
  ('saga.quests.read_hidden', 'quests', 'read_hidden', 'See gm_only quests'),
  ('saga.quests.create', 'quests', 'create', 'Create quest'),
  ('saga.quests.update', 'quests', 'update', 'Update quest'),
  ('saga.quests.delete', 'quests', 'delete', 'Delete quest'),
  ('saga.lore.read', 'lore', 'read', 'Lore / Verlauf party-safe'),
  ('saga.lore.read_hidden', 'lore', 'read_hidden', 'GM notes / unrevealed facts'),
  ('saga.secrets.read', 'secrets', 'read', 'Hidden catalog + lore alias'),
  ('saga.secrets.reveal', 'secrets', 'reveal', 'Flip binding reveal'),
  ('saga.sessions.create', 'sessions', 'create', 'Host session'),
  ('saga.sessions.join', 'sessions', 'join', 'Join by code'),
  ('saga.sessions.lobby.manage', 'sessions', 'lobby.manage', 'Lobby manage'),
  ('saga.sessions.invite.copy', 'sessions', 'invite.copy', 'Copy invite code'),
  ('saga.sessions.live.run', 'sessions', 'live.run', 'GM live surface'),
  ('saga.sessions.recap.approve', 'sessions', 'recap.approve', 'Approve recap'),
  ('saga.members.read', 'members', 'read', 'Member list'),
  ('saga.members.invite', 'members', 'invite', 'Invite flows'),
  ('saga.members.kick', 'members', 'kick', 'Remove member'),
  ('saga.members.set_bundle', 'members', 'set_bundle', 'Assign/revoke bundles'),
  ('saga.settings.read', 'settings', 'read', 'Saga settings read'),
  ('saga.settings.update', 'settings', 'update', 'Saga settings update'),
  ('saga.story.read', 'story', 'read', 'Story definition read'),
  ('saga.story.update', 'story', 'update', 'Story definition update');

INSERT OR IGNORE INTO saga_permission_bundles (id, label, description) VALUES
  ('bundle.saga.gm', 'Gamemaster', 'Vollzugriff inkl. Geheimnisse und Bundle-Vergabe'),
  ('bundle.saga.player', 'Spieler', 'Party-Sicht ohne Geheimnisse und ohne Governance');

INSERT OR IGNORE INTO saga_permission_bundle_keys (bundle_id, permission_key)
SELECT 'bundle.saga.gm', key FROM saga_permission_keys;

INSERT OR IGNORE INTO saga_permission_bundle_keys (bundle_id, permission_key)
SELECT 'bundle.saga.player', v.key FROM (
  SELECT 'saga.workspace.access' AS key UNION ALL
  SELECT 'saga.characters.read' UNION ALL
  SELECT 'saga.characters.create' UNION ALL
  SELECT 'saga.characters.update_own' UNION ALL
  SELECT 'saga.world.read' UNION ALL
  SELECT 'saga.npc.read' UNION ALL
  SELECT 'saga.items.read' UNION ALL
  SELECT 'saga.quests.read' UNION ALL
  SELECT 'saga.lore.read' UNION ALL
  SELECT 'saga.sessions.join' UNION ALL
  SELECT 'saga.sessions.invite.copy' UNION ALL
  SELECT 'saga.members.read' UNION ALL
  SELECT 'saga.settings.read' UNION ALL
  SELECT 'saga.story.read'
) AS v;
