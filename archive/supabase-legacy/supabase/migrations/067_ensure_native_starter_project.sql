-- #ensure-dornhain-starter — Idempotent native starter playthrough (Dornhain) per GM user.
-- SessionJoin / Library list user projects, not saga_definitions; this bridges the gap
-- so "Das Flüstern unter Dornhain" is selectable like Core/builtin catalogs for items/NPCs.

CREATE OR REPLACE FUNCTION public.ensure_native_starter_project(
  p_slug TEXT DEFAULT 'dornhain.whisper'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
  v_def public.saga_definitions%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  existing public.projects%ROWTYPE;
  created public.projects%ROWTYPE;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_def
  FROM public.saga_definitions
  WHERE slug = BTRIM(COALESCE(p_slug, ''))
    AND origin = 'native';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Native Saga nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  SELECT v.* INTO v_ver
  FROM public.saga_definition_versions v
  WHERE v.saga_id = v_def.id
    AND v.status = 'published'
  ORDER BY v.published_at DESC NULLS LAST
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keine veröffentlichte Fassung' USING ERRCODE = 'P0002';
  END IF;

  SELECT p.* INTO existing
  FROM public.projects p
  WHERE p.gm_user_id = actor
    AND p.saga_id = v_def.id
    AND p.status IN ('active', 'paused')
  ORDER BY p.created_at ASC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'id', existing.id,
      'public_id', existing.public_id,
      'created', false,
      'name', existing.name,
      'saga_id', v_def.id,
      'saga_version_id', COALESCE(existing.saga_version_id, v_ver.id)
    );
  END IF;

  created := public.create_project_from_saga_version(v_def.id, v_ver.id, v_def.title);

  RETURN jsonb_build_object(
    'id', created.id,
    'public_id', created.public_id,
    'created', true,
    'name', created.name,
    'saga_id', v_def.id,
    'saga_version_id', v_ver.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_native_starter_project(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_native_starter_project(TEXT) TO authenticated;

COMMENT ON FUNCTION public.ensure_native_starter_project(TEXT) IS
  'Returns existing GM playthrough for a native saga slug or creates one (default dornhain.whisper).';
