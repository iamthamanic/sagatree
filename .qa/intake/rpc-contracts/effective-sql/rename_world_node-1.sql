-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.rename_world_node(p_world_profile_id uuid, p_place_id uuid, p_name text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_row public.world_places%ROWTYPE;
  v_name TEXT := NULLIF(btrim(p_name), '');
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'empty name' USING ERRCODE = '22023';
  END IF;

  v_row := public.atlas_wb_place_row(p_world_profile_id, p_place_id);
  v_status := CASE WHEN v_row.status = 'placeholder' THEN 'draft' ELSE v_row.status END;

  UPDATE public.world_places
  SET
    name = v_name,
    status = v_status,
    revision = revision + 1,
    updated_at = NOW()
  WHERE id = p_place_id AND world_profile_id = p_world_profile_id
  RETURNING * INTO v_row;

  RETURN public.atlas_wb_place_json(v_row);
END;
$$;
