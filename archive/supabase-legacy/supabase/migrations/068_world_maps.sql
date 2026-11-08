-- #580 — world_maps tile map per world_profile + pin image storage.

INSERT INTO storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
) VALUES (
  'world-map-pins',
  'world-map-pins',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload world map pins" ON storage.objects;
DROP POLICY IF EXISTS "Users can read world map pins" ON storage.objects;
DROP POLICY IF EXISTS "Users can update world map pins" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete world map pins" ON storage.objects;

CREATE POLICY "Users can upload world map pins"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'world-map-pins'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read world map pins"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'world-map-pins'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update world map pins"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'world-map-pins'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'world-map-pins'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete world map pins"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'world-map-pins'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE TABLE IF NOT EXISTS public.world_maps (
  world_profile_id UUID PRIMARY KEY REFERENCES public.world_profiles(id) ON DELETE CASCADE,
  revision BIGINT NOT NULL DEFAULT 0,
  map_data JSONB NOT NULL DEFAULT '{"size":24,"tiles":{},"countries":[],"pins":[]}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.world_maps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "world_maps_select" ON public.world_maps;
DROP POLICY IF EXISTS "world_maps_insert" ON public.world_maps;
DROP POLICY IF EXISTS "world_maps_update" ON public.world_maps;
DROP POLICY IF EXISTS "world_maps_delete" ON public.world_maps;

CREATE POLICY "world_maps_select" ON public.world_maps
  FOR SELECT TO authenticated
  USING (public.current_user_can_read_world_profile(world_profile_id));

CREATE POLICY "world_maps_insert" ON public.world_maps
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_world_profile(world_profile_id));

CREATE POLICY "world_maps_update" ON public.world_maps
  FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id))
  WITH CHECK (public.current_user_can_edit_world_profile(world_profile_id));

CREATE POLICY "world_maps_delete" ON public.world_maps
  FOR DELETE TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id));

CREATE OR REPLACE FUNCTION public.get_world_map(
  p_world_profile_id UUID,
  p_player_view BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.get_world_map(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_world_map(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.save_world_map(
  p_world_profile_id UUID,
  p_expected_revision BIGINT,
  p_map_data JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

REVOKE ALL ON FUNCTION public.save_world_map(UUID, BIGINT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_world_map(UUID, BIGINT, JSONB) TO authenticated;

COMMENT ON TABLE public.world_maps IS
  'Tile map per world_profile (#580); map_data has no Base64 images.';
