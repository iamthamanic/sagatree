-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.list_saga_bindings(p_public_id text, p_asset_kind text = NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
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
        'metadata', b.metadata,
        'worldPlaceId', b.world_place_id
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
