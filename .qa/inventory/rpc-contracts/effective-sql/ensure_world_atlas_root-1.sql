-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.ensure_world_atlas_root(p_world_profile_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_user_can_edit_world_profile(p_world_profile_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_id
  FROM public.world_atlas_maps
  WHERE world_profile_id = p_world_profile_id
    AND parent_map_id IS NULL
  ORDER BY CASE WHEN kind = 'legacy_tiles' THEN 0 ELSE 1 END, sort_order
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, kind, title, generator_meta
    ) VALUES (
      p_world_profile_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.world_maps w WHERE w.world_profile_id = p_world_profile_id
      ) THEN 'legacy_tiles' ELSE 'world' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM public.world_maps w WHERE w.world_profile_id = p_world_profile_id
      ) THEN 'Kachelkarte (Legacy)' ELSE 'Weltkarte' END,
      jsonb_build_object(
        'engine',
        CASE WHEN EXISTS (
          SELECT 1 FROM public.world_maps w WHERE w.world_profile_id = p_world_profile_id
        ) THEN 'legacy_tiles' ELSE 'manual' END
      )
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN public.list_world_atlas_maps(p_world_profile_id, false, NULL);
END;
$$;
