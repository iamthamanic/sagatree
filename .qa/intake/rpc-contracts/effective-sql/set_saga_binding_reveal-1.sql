-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.set_saga_binding_reveal(p_project_id uuid, p_binding_id uuid, p_reveal text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
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
