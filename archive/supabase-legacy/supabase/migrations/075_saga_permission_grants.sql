-- #617 Phase 2 — saga permission catalog, member grants, binding reveal, lore timeline.
-- Idempotent. Grants are RPC-managed; clients never INSERT/UPDATE grant rows directly.

CREATE TABLE IF NOT EXISTS public.saga_permission_keys (
  key TEXT PRIMARY KEY,
  area TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.saga_permission_keys IS
  '#617 Catalog of saga.{area}.{action} capability keys.';

CREATE TABLE IF NOT EXISTS public.saga_permission_bundles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saga_permission_bundle_keys (
  bundle_id TEXT NOT NULL REFERENCES public.saga_permission_bundles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.saga_permission_keys(key) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, permission_key)
);

-- Effective grants per project member (expanded from bundles and/or individual keys).
CREATE TABLE IF NOT EXISTS public.project_member_saga_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.project_members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.saga_permission_keys(key) ON DELETE CASCADE,
  source_bundle_id TEXT NULL REFERENCES public.saga_permission_bundles(id) ON DELETE SET NULL,
  granted_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (member_id, permission_key)
);

CREATE INDEX IF NOT EXISTS idx_project_member_saga_grants_project_user
  ON public.project_member_saga_grants (project_id, user_id);

CREATE INDEX IF NOT EXISTS idx_project_member_saga_grants_key
  ON public.project_member_saga_grants (project_id, permission_key);

-- Which bundle is assigned to a member (display + revoke helper).
CREATE TABLE IF NOT EXISTS public.project_member_saga_bundles (
  member_id UUID PRIMARY KEY REFERENCES public.project_members(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bundle_id TEXT NOT NULL REFERENCES public.saga_permission_bundles(id) ON DELETE RESTRICT,
  assigned_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Saga ↔ asset bindings carry reveal audience (not the catalog row alone).
CREATE TABLE IF NOT EXISTS public.saga_asset_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asset_kind TEXT NOT NULL
    CHECK (asset_kind IN ('character', 'npc', 'item', 'quest', 'map', 'location', 'lore')),
  asset_id TEXT NOT NULL,
  reveal TEXT NOT NULL DEFAULT 'gm_only'
    CHECK (reveal IN ('gm_only', 'party', 'unlisted')),
  label TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, asset_kind, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_saga_asset_bindings_project_kind
  ON public.saga_asset_bindings (project_id, asset_kind);

COMMENT ON TABLE public.saga_asset_bindings IS
  '#617 Binding reveal: gm_only | party | unlisted. Default gm_only.';

-- Seed catalog keys (idempotent upsert).
INSERT INTO public.saga_permission_keys (key, area, action, description) VALUES
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
  ('saga.story.update', 'story', 'update', 'Story definition update')
ON CONFLICT (key) DO UPDATE SET
  area = EXCLUDED.area,
  action = EXCLUDED.action,
  description = EXCLUDED.description;

INSERT INTO public.saga_permission_bundles (id, label, description) VALUES
  ('bundle.saga.gm', 'Gamemaster', 'Vollzugriff inkl. Geheimnisse und Bundle-Vergabe'),
  ('bundle.saga.player', 'Spieler', 'Party-Sicht ohne Geheimnisse und ohne Governance')
ON CONFLICT (id) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description;

-- GM bundle: all keys
INSERT INTO public.saga_permission_bundle_keys (bundle_id, permission_key)
SELECT 'bundle.saga.gm', k.key
FROM public.saga_permission_keys k
ON CONFLICT DO NOTHING;

-- Player bundle: design allow-list
INSERT INTO public.saga_permission_bundle_keys (bundle_id, permission_key)
SELECT 'bundle.saga.player', v.key
FROM (
  VALUES
    ('saga.workspace.access'),
    ('saga.characters.read'),
    ('saga.characters.create'),
    ('saga.characters.update_own'),
    ('saga.world.read'),
    ('saga.npc.read'),
    ('saga.items.read'),
    ('saga.quests.read'),
    ('saga.lore.read'),
    ('saga.sessions.join'),
    ('saga.sessions.invite.copy'),
    ('saga.members.read'),
    ('saga.settings.read'),
    ('saga.story.read')
) AS v(key)
ON CONFLICT DO NOTHING;

ALTER TABLE public.saga_permission_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saga_permission_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saga_permission_bundle_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_member_saga_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_member_saga_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saga_asset_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read saga permission keys" ON public.saga_permission_keys;
CREATE POLICY "Authenticated read saga permission keys"
  ON public.saga_permission_keys FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated read saga permission bundles" ON public.saga_permission_bundles;
CREATE POLICY "Authenticated read saga permission bundles"
  ON public.saga_permission_bundles FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated read saga permission bundle keys" ON public.saga_permission_bundle_keys;
CREATE POLICY "Authenticated read saga permission bundle keys"
  ON public.saga_permission_bundle_keys FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Members read own saga grants" ON public.project_member_saga_grants;
CREATE POLICY "Members read own saga grants"
  ON public.project_member_saga_grants FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_project_gm(project_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members read saga bundles" ON public.project_member_saga_bundles;
CREATE POLICY "Members read saga bundles"
  ON public.project_member_saga_bundles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_project_gm(project_id, auth.uid())
  );

-- Bindings: SELECT filtered by reveal + permission via helper (policy uses helper).
CREATE OR REPLACE FUNCTION public.can_view_saga_binding(
  p_project_id UUID,
  p_reveal TEXT,
  p_asset_kind TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_hidden_key TEXT;
  v_read_key TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  IF NOT public.current_user_is_active_project_member(p_project_id)
     AND NOT public.is_project_gm(p_project_id, v_uid) THEN
    RETURN false;
  END IF;

  IF p_reveal = 'unlisted' THEN
    -- Not in list RPCs; deep-link / GM with secrets only.
    RETURN public.has_saga_permission(p_project_id, 'saga.secrets.read')
        OR public.has_saga_permission(p_project_id, 'saga.secrets.reveal')
        OR public.is_project_gm(p_project_id, v_uid);
  END IF;

  IF p_reveal = 'gm_only' THEN
    v_hidden_key := CASE p_asset_kind
      WHEN 'npc' THEN 'saga.npc.read_hidden'
      WHEN 'item' THEN 'saga.items.read_hidden'
      WHEN 'quest' THEN 'saga.quests.read_hidden'
      WHEN 'lore' THEN 'saga.lore.read_hidden'
      ELSE 'saga.secrets.read'
    END;
    RETURN public.has_saga_permission(p_project_id, v_hidden_key)
        OR public.has_saga_permission(p_project_id, 'saga.secrets.read')
        OR public.is_project_gm(p_project_id, v_uid);
  END IF;

  -- party
  v_read_key := CASE p_asset_kind
    WHEN 'character' THEN 'saga.characters.read'
    WHEN 'npc' THEN 'saga.npc.read'
    WHEN 'item' THEN 'saga.items.read'
    WHEN 'quest' THEN 'saga.quests.read'
    WHEN 'map' THEN 'saga.world.read'
    WHEN 'location' THEN 'saga.world.read'
    WHEN 'lore' THEN 'saga.lore.read'
    ELSE 'saga.workspace.access'
  END;
  RETURN public.has_saga_permission(p_project_id, v_read_key)
      OR public.is_project_gm(p_project_id, v_uid);
END;
$$;

-- Forward declaration stub so can_view can compile; replaced below.
CREATE OR REPLACE FUNCTION public.has_saga_permission(
  p_project_id UUID,
  p_permission_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;
  IF public.is_project_gm(p_project_id, v_uid) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.project_member_saga_grants g
    WHERE g.project_id = p_project_id
      AND g.user_id = v_uid
      AND g.permission_key = p_permission_key
  );
END;
$$;

DROP POLICY IF EXISTS "Members view allowed saga bindings" ON public.saga_asset_bindings;
CREATE POLICY "Members view allowed saga bindings"
  ON public.saga_asset_bindings FOR SELECT TO authenticated
  USING (public.can_view_saga_binding(project_id, reveal, asset_kind));

-- No direct client mutations on grants/bindings — RPCs only.
REVOKE ALL ON TABLE public.project_member_saga_grants FROM PUBLIC;
REVOKE ALL ON TABLE public.project_member_saga_bundles FROM PUBLIC;
REVOKE ALL ON TABLE public.saga_asset_bindings FROM PUBLIC;
GRANT SELECT ON TABLE public.saga_permission_keys TO authenticated;
GRANT SELECT ON TABLE public.saga_permission_bundles TO authenticated;
GRANT SELECT ON TABLE public.saga_permission_bundle_keys TO authenticated;
GRANT SELECT ON TABLE public.project_member_saga_grants TO authenticated;
GRANT SELECT ON TABLE public.project_member_saga_bundles TO authenticated;
GRANT SELECT ON TABLE public.saga_asset_bindings TO authenticated;
GRANT ALL ON TABLE public.project_member_saga_grants TO service_role;
GRANT ALL ON TABLE public.project_member_saga_bundles TO service_role;
GRANT ALL ON TABLE public.saga_asset_bindings TO service_role;

CREATE OR REPLACE FUNCTION public.has_saga_permission(
  p_project_id UUID,
  p_permission_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_permission_key IS NULL OR BTRIM(p_permission_key) = '' THEN
    RETURN false;
  END IF;
  -- Project GM / gm_user_id always passes (legacy bridge until all callers use grants).
  IF public.is_project_gm(p_project_id, v_uid) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.project_member_saga_grants g
    JOIN public.project_members m ON m.id = g.member_id
    WHERE g.project_id = p_project_id
      AND g.user_id = v_uid
      AND g.permission_key = p_permission_key
      AND m.status = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.has_saga_permission(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_saga_permission(UUID, TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.can_view_saga_binding(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_saga_binding(UUID, TEXT, TEXT) TO authenticated;

-- Expand a bundle onto a member (replace prior grants from any bundle).
CREATE OR REPLACE FUNCTION public.set_saga_member_bundle(
  p_project_id UUID,
  p_member_id UUID,
  p_bundle_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member RECORD;
  v_governance_left INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_saga_permission(p_project_id, 'saga.members.set_bundle')
     AND NOT public.is_project_gm(p_project_id, v_uid) THEN
    RAISE EXCEPTION 'missing saga.members.set_bundle';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saga_permission_bundles WHERE id = p_bundle_id) THEN
    RAISE EXCEPTION 'unknown bundle %', p_bundle_id;
  END IF;

  SELECT * INTO v_member
  FROM public.project_members
  WHERE id = p_member_id AND project_id = p_project_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member not found';
  END IF;

  -- Invariant: cannot demote last holder of set_bundle away from GM bundle.
  IF p_bundle_id <> 'bundle.saga.gm' THEN
    SELECT COUNT(DISTINCT g.user_id) INTO v_governance_left
    FROM public.project_member_saga_grants g
    JOIN public.project_members m ON m.id = g.member_id
    WHERE g.project_id = p_project_id
      AND g.permission_key = 'saga.members.set_bundle'
      AND m.status = 'active'
      AND g.member_id <> p_member_id;
    IF COALESCE(v_governance_left, 0) < 1
       AND EXISTS (
         SELECT 1 FROM public.project_member_saga_grants
         WHERE member_id = p_member_id AND permission_key = 'saga.members.set_bundle'
       ) THEN
      RAISE EXCEPTION 'cannot revoke last saga.members.set_bundle grant';
    END IF;
  END IF;

  DELETE FROM public.project_member_saga_grants WHERE member_id = p_member_id;

  INSERT INTO public.project_member_saga_grants (
    project_id, member_id, user_id, permission_key, source_bundle_id, granted_by
  )
  SELECT
    p_project_id,
    p_member_id,
    v_member.user_id,
    bk.permission_key,
    p_bundle_id,
    v_uid
  FROM public.saga_permission_bundle_keys bk
  WHERE bk.bundle_id = p_bundle_id;

  INSERT INTO public.project_member_saga_bundles (
    member_id, project_id, user_id, bundle_id, assigned_by, updated_at
  ) VALUES (
    p_member_id, p_project_id, v_member.user_id, p_bundle_id, v_uid, NOW()
  )
  ON CONFLICT (member_id) DO UPDATE SET
    bundle_id = EXCLUDED.bundle_id,
    assigned_by = EXCLUDED.assigned_by,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'memberId', p_member_id,
    'bundleId', p_bundle_id,
    'grantCount', (
      SELECT COUNT(*)::INT FROM public.project_member_saga_grants WHERE member_id = p_member_id
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_saga_member_bundle(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_saga_member_bundle(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_saga_binding_reveal(
  p_project_id UUID,
  p_binding_id UUID,
  p_reveal TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_row public.saga_asset_bindings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_reveal NOT IN ('gm_only', 'party', 'unlisted') THEN
    RAISE EXCEPTION 'invalid reveal %', p_reveal;
  END IF;
  IF NOT public.has_saga_permission(p_project_id, 'saga.secrets.reveal')
     AND NOT public.is_project_gm(p_project_id, v_uid) THEN
    RAISE EXCEPTION 'missing saga.secrets.reveal';
  END IF;

  UPDATE public.saga_asset_bindings
  SET reveal = p_reveal, updated_at = NOW()
  WHERE id = p_binding_id AND project_id = p_project_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'binding not found';
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'assetKind', v_row.asset_kind,
    'assetId', v_row.asset_id,
    'reveal', v_row.reveal,
    'label', v_row.label
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_saga_binding_reveal(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_saga_binding_reveal(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_saga_bindings(
  p_public_id TEXT,
  p_asset_kind TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO v_project_id
  FROM public.projects
  WHERE public_id = UPPER(BTRIM(p_public_id));

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'saga not found';
  END IF;

  IF NOT public.current_user_is_active_project_member(v_project_id)
     AND NOT public.is_project_gm(v_project_id, v_uid) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', b.id,
        'assetKind', b.asset_kind,
        'assetId', b.asset_id,
        'reveal', b.reveal,
        'label', b.label,
        'metadata', b.metadata
      )
      ORDER BY b.asset_kind, b.label, b.asset_id
    )
    FROM public.saga_asset_bindings b
    WHERE b.project_id = v_project_id
      AND (p_asset_kind IS NULL OR b.asset_kind = p_asset_kind)
      AND public.can_view_saga_binding(b.project_id, b.reveal, b.asset_kind)
      AND b.reveal <> 'unlisted'
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.list_saga_bindings(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_saga_bindings(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_saga_permissions(p_public_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id UUID;
  v_uid UUID := auth.uid();
  v_bundle TEXT;
  v_keys JSONB;
  v_is_gm BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO v_project_id
  FROM public.projects
  WHERE public_id = UPPER(BTRIM(p_public_id));

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'saga not found';
  END IF;

  v_is_gm := public.is_project_gm(v_project_id, v_uid);

  IF NOT public.current_user_is_active_project_member(v_project_id) AND NOT v_is_gm THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  SELECT b.bundle_id INTO v_bundle
  FROM public.project_member_saga_bundles b
  WHERE b.project_id = v_project_id AND b.user_id = v_uid;

  IF v_is_gm THEN
    SELECT COALESCE(jsonb_agg(k.key ORDER BY k.key), '[]'::jsonb) INTO v_keys
    FROM public.saga_permission_keys k;
    v_bundle := COALESCE(v_bundle, 'bundle.saga.gm');
  ELSE
    SELECT COALESCE(jsonb_agg(g.permission_key ORDER BY g.permission_key), '[]'::jsonb) INTO v_keys
    FROM public.project_member_saga_grants g
    WHERE g.project_id = v_project_id AND g.user_id = v_uid;
  END IF;

  RETURN jsonb_build_object(
    'projectId', v_project_id,
    'bundleId', v_bundle,
    'isGm', v_is_gm,
    'keys', COALESCE(v_keys, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_saga_permissions(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_saga_permissions(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_saga_member_permission_state(p_public_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO v_project_id
  FROM public.projects
  WHERE public_id = UPPER(BTRIM(p_public_id));

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'saga not found';
  END IF;

  IF NOT public.has_saga_permission(v_project_id, 'saga.members.read')
     AND NOT public.is_project_gm(v_project_id, v_uid) THEN
    RAISE EXCEPTION 'missing saga.members.read';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'memberId', m.id,
        'userId', m.user_id,
        'role', m.role,
        'status', m.status,
        'bundleId', b.bundle_id,
        'canSetBundle', public.has_saga_permission(v_project_id, 'saga.members.set_bundle')
          OR public.is_project_gm(v_project_id, v_uid)
      )
      ORDER BY m.joined_at
    )
    FROM public.project_members m
    LEFT JOIN public.project_member_saga_bundles b ON b.member_id = m.id
    WHERE m.project_id = v_project_id AND m.status = 'active'
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.list_saga_member_permission_state(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_saga_member_permission_state(TEXT) TO authenticated;

-- Lore / Verlauf: recaps + definition knowledgeFacts projected by audience.
CREATE OR REPLACE FUNCTION public.get_saga_lore_timeline(p_public_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_project RECORD;
  v_uid UUID := auth.uid();
  v_is_gm BOOLEAN;
  v_can_hidden BOOLEAN;
  v_entries JSONB := '[]'::jsonb;
  v_payload JSONB;
  v_elem JSONB;
  v_vis TEXT;
  v_recap RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT p.id, p.saga_id, p.saga_version_id
  INTO v_project
  FROM public.projects p
  WHERE p.public_id = UPPER(BTRIM(p_public_id));

  IF v_project.id IS NULL THEN
    RAISE EXCEPTION 'saga not found';
  END IF;

  IF NOT public.current_user_is_active_project_member(v_project.id)
     AND NOT public.is_project_gm(v_project.id, v_uid) THEN
    RAISE EXCEPTION 'not a member';
  END IF;

  IF NOT public.has_saga_permission(v_project.id, 'saga.lore.read')
     AND NOT public.is_project_gm(v_project.id, v_uid) THEN
    RAISE EXCEPTION 'missing saga.lore.read';
  END IF;

  v_is_gm := public.is_project_gm(v_project.id, v_uid);
  v_can_hidden := v_is_gm
    OR public.has_saga_permission(v_project.id, 'saga.lore.read_hidden')
    OR public.has_saga_permission(v_project.id, 'saga.secrets.read');

  -- Episode recaps (sessions of this project).
  FOR v_recap IN
    SELECT s.public_id AS session_public_id, s.name AS session_name, s.session_number,
           r.summary_text, r.highlight_lines, r.updated_at
    FROM public.sessions s
    JOIN public.session_recaps r ON r.session_id = s.id
    WHERE s.project_id = v_project.id
    ORDER BY COALESCE(s.session_number, 0) DESC, r.updated_at DESC
    LIMIT 40
  LOOP
    v_entries := v_entries || jsonb_build_array(
      jsonb_build_object(
        'id', 'recap:' || COALESCE(v_recap.session_public_id, ''),
        'kind', 'recap',
        'title', COALESCE(v_recap.session_name, 'Episode'),
        'summary', COALESCE(v_recap.summary_text, ''),
        'visibility', 'shared',
        'occurredAt', v_recap.updated_at,
        'meta', jsonb_build_object(
          'sessionPublicId', v_recap.session_public_id,
          'sessionNumber', v_recap.session_number,
          'highlightLines', COALESCE(v_recap.highlight_lines, '[]'::jsonb)
        )
      )
    );
  END LOOP;

  -- Definition knowledge facts (if saga linked).
  IF v_project.saga_version_id IS NOT NULL THEN
    SELECT payload INTO v_payload
    FROM public.saga_definition_versions
    WHERE id = v_project.saga_version_id;

    FOR v_elem IN
      SELECT elem
      FROM jsonb_array_elements(COALESCE(v_payload->'knowledgeFacts', '[]'::jsonb)) AS elem
    LOOP
      v_vis := COALESCE(v_elem->>'visibility', 'gm_only');
      IF v_can_hidden OR v_vis IN ('public', 'shared', 'discovered') THEN
        v_entries := v_entries || jsonb_build_array(
          jsonb_build_object(
            'id', 'fact:' || COALESCE(v_elem->>'id', md5(v_elem::text)),
            'kind', 'knowledge',
            'title', COALESCE(v_elem->>'id', 'Wissen'),
            'summary', COALESCE(v_elem->>'summary', ''),
            'visibility', v_vis,
            'occurredAt', NULL,
            'meta', '{}'::jsonb
          )
        );
      END IF;
    END LOOP;
  END IF;

  -- Bound lore assets revealed to viewer.
  v_entries := v_entries || COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', 'binding:' || b.id::text,
        'kind', 'lore_binding',
        'title', NULLIF(BTRIM(b.label), ''),
        'summary', COALESCE(b.metadata->>'summary', ''),
        'visibility', b.reveal,
        'occurredAt', b.updated_at,
        'meta', jsonb_build_object('bindingId', b.id, 'reveal', b.reveal)
      )
    )
    FROM public.saga_asset_bindings b
    WHERE b.project_id = v_project.id
      AND b.asset_kind = 'lore'
      AND public.can_view_saga_binding(b.project_id, b.reveal, b.asset_kind)
      AND b.reveal <> 'unlisted'
  ), '[]'::jsonb);

  RETURN jsonb_build_object(
    'projectId', v_project.id,
    'canReadHidden', v_can_hidden,
    'entries', COALESCE(v_entries, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_saga_lore_timeline(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_saga_lore_timeline(TEXT) TO authenticated;

-- Backfill: active GMs → GM bundle; active players → player bundle (once).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT m.id AS member_id, m.project_id, m.user_id, m.role
    FROM public.project_members m
    WHERE m.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM public.project_member_saga_bundles b WHERE b.member_id = m.id
      )
  LOOP
    IF r.role = 'gm' OR public.is_project_gm(r.project_id, r.user_id) THEN
      DELETE FROM public.project_member_saga_grants WHERE member_id = r.member_id;
      INSERT INTO public.project_member_saga_grants (
        project_id, member_id, user_id, permission_key, source_bundle_id, granted_by
      )
      SELECT r.project_id, r.member_id, r.user_id, bk.permission_key, 'bundle.saga.gm', NULL
      FROM public.saga_permission_bundle_keys bk
      WHERE bk.bundle_id = 'bundle.saga.gm';
      INSERT INTO public.project_member_saga_bundles (
        member_id, project_id, user_id, bundle_id, assigned_by, updated_at
      ) VALUES (
        r.member_id, r.project_id, r.user_id, 'bundle.saga.gm', NULL, NOW()
      )
      ON CONFLICT (member_id) DO NOTHING;
    ELSE
      DELETE FROM public.project_member_saga_grants WHERE member_id = r.member_id;
      INSERT INTO public.project_member_saga_grants (
        project_id, member_id, user_id, permission_key, source_bundle_id, granted_by
      )
      SELECT r.project_id, r.member_id, r.user_id, bk.permission_key, 'bundle.saga.player', NULL
      FROM public.saga_permission_bundle_keys bk
      WHERE bk.bundle_id = 'bundle.saga.player';
      INSERT INTO public.project_member_saga_bundles (
        member_id, project_id, user_id, bundle_id, assigned_by, updated_at
      ) VALUES (
        r.member_id, r.project_id, r.user_id, 'bundle.saga.player', NULL, NOW()
      )
      ON CONFLICT (member_id) DO NOTHING;
    END IF;
  END LOOP;

  -- Ensure project gm_user_id holders have governance even if not in members yet.
  FOR r IN
    SELECT p.id AS project_id, p.gm_user_id AS user_id, m.id AS member_id
    FROM public.projects p
    LEFT JOIN public.project_members m
      ON m.project_id = p.id AND m.user_id = p.gm_user_id AND m.status = 'active'
    WHERE p.gm_user_id IS NOT NULL
  LOOP
    IF r.member_id IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.project_member_saga_grants
      WHERE member_id = r.member_id AND permission_key = 'saga.members.set_bundle'
    ) THEN
      DELETE FROM public.project_member_saga_grants WHERE member_id = r.member_id;
      INSERT INTO public.project_member_saga_grants (
        project_id, member_id, user_id, permission_key, source_bundle_id, granted_by
      )
      SELECT r.project_id, r.member_id, r.user_id, bk.permission_key, 'bundle.saga.gm', NULL
      FROM public.saga_permission_bundle_keys bk
      WHERE bk.bundle_id = 'bundle.saga.gm';
      INSERT INTO public.project_member_saga_bundles (
        member_id, project_id, user_id, bundle_id, assigned_by, updated_at
      ) VALUES (
        r.member_id, r.project_id, r.user_id, 'bundle.saga.gm', NULL, NOW()
      )
      ON CONFLICT (member_id) DO UPDATE SET
        bundle_id = 'bundle.saga.gm',
        updated_at = NOW();
    END IF;
  END LOOP;
END;
$$;
