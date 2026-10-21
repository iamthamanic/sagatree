-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_world_map(p_world_profile_id uuid, p_player_view boolean = FALSE) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_row public.world_maps%ROWTYPE;
  v_data JSONB;
  v_pins JSONB;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_world_profile_id IS NULL THEN
    RAISE EXCEPTION 'world_profile_id required' USING ERRCODE = '22023';
  END IF;
  IF NOT public.current_user_can_read_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.world_maps WHERE world_profile_id = p_world_profile_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'worldProfileId', p_world_profile_id,
      'revision', 0,
      'mapData', jsonb_build_object(
        'size', 24,
        'tiles', '{}'::jsonb,
        'countries', '[]'::jsonb,
        'pins', '[]'::jsonb
      ),
      'updatedAt', NULL
    );
  END IF;

  v_data := COALESCE(v_row.map_data, '{}'::jsonb);
  IF p_player_view THEN
    SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
      INTO v_pins
      FROM jsonb_array_elements(COALESCE(v_data->'pins', '[]'::jsonb)) AS elem
     WHERE COALESCE((elem->>'discovered')::boolean, true) IS TRUE;
    v_data := jsonb_set(v_data, '{pins}', v_pins, true);
  END IF;

  RETURN jsonb_build_object(
    'worldProfileId', v_row.world_profile_id,
    'revision', v_row.revision,
    'mapData', v_data,
    'updatedAt', v_row.updated_at
  );
END;
$$;
