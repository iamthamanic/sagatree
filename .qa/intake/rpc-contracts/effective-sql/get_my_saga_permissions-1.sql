-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_my_saga_permissions(p_public_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
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
