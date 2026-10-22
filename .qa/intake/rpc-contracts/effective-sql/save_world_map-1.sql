-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.save_world_map(p_world_profile_id uuid, p_expected_revision bigint, p_map_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.world_maps%ROWTYPE;
  v_size INT;
  v_next BIGINT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_world_profile_id IS NULL THEN
    RAISE EXCEPTION 'world_profile_id required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_map_data IS NULL OR jsonb_typeof(p_map_data) <> 'object' THEN
    RAISE EXCEPTION 'map_data ungültig' USING ERRCODE = '22023';
  END IF;

  v_size := COALESCE((p_map_data->>'size')::INT, 24);
  IF v_size < 1 OR v_size > 60 THEN
    RAISE EXCEPTION 'Kartengröße muss zwischen 1 und 60 liegen' USING ERRCODE = '22023';
  END IF;

  -- Reject Base64 image payloads in pins
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(p_map_data->'pins', '[]'::jsonb)) AS elem
    WHERE COALESCE(elem->>'imagePath', '') LIKE 'data:%'
       OR length(COALESCE(elem->>'imagePath', '')) > 512
  ) THEN
    RAISE EXCEPTION 'Pin-Bilder müssen Storage-Pfade sein (kein Base64)' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_row FROM public.world_maps WHERE world_profile_id = p_world_profile_id FOR UPDATE;
  IF FOUND THEN
    IF COALESCE(p_expected_revision, -1) >= 0 AND v_row.revision <> p_expected_revision THEN
      RAISE EXCEPTION 'revision conflict' USING ERRCODE = '40001';
    END IF;
    v_next := v_row.revision + 1;
    UPDATE public.world_maps
    SET map_data = p_map_data,
        revision = v_next,
        updated_at = now()
    WHERE world_profile_id = p_world_profile_id
    RETURNING * INTO v_row;
  ELSE
    v_next := 1;
    INSERT INTO public.world_maps (world_profile_id, revision, map_data, updated_at)
    VALUES (p_world_profile_id, v_next, p_map_data, now())
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'worldProfileId', v_row.world_profile_id,
    'revision', v_row.revision,
    'mapData', v_row.map_data,
    'updatedAt', v_row.updated_at
  );
END;
$$;
