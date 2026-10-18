-- #dornhain-unified-atlas-v3 — Blank planetary ocean; root layer title „Welt“.
-- Upgrades seed dornhain.unified.v1/v2 → v3.

CREATE OR REPLACE FUNCTION public.build_dornhain_unified_generator_meta()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT $dornhain_meta${"engine":"unified_canvas","sagaSlug":"dornhain.whisper","seed":"dornhain.unified.v3","scale":"world","unifiedCanvas":{"format":"sagatree-unified-atlas-v1","layers":{"terrain":true,"roads":true,"region":true,"city":true,"interior":true,"drawings":true,"objects":true,"grid":false},"strokes":[],"objects":[],"rooms":[{"id":"w.ocean","material":"wasser","x":0,"y":0,"w":1000,"h":1000}],"walls":[],"demoSeed":false}}$dornhain_meta$::jsonb;
$fn$;

REVOKE ALL ON FUNCTION public.build_dornhain_unified_generator_meta() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_dornhain_unified_generator_meta() TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.seed_dornhain_unified_atlas(p_world_profile_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_root UUID;
  v_settlement UUID;
  v_dornhain UUID;
  v_meta JSONB := public.build_dornhain_unified_generator_meta();
BEGIN
  IF p_world_profile_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO v_root
  FROM public.world_atlas_maps
  WHERE world_profile_id = p_world_profile_id AND kind = 'world'
  ORDER BY sort_order, created_at
  LIMIT 1;

  IF v_root IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta
    ) VALUES (
      p_world_profile_id, NULL, 'world', 'Welt', 10,
      '{"minX":0,"minY":0,"maxX":1000,"maxY":1000}'::jsonb,
      v_meta
    )
    RETURNING id INTO v_root;
  ELSE
    UPDATE public.world_atlas_maps
    SET
      title = CASE
        WHEN title IN (
          'Weltkarte',
          'Weltkarte (Unified)',
          'Kachelkarte (Legacy)',
          'Dornhain Übersicht (Unified)'
        ) OR btrim(title) = '' THEN 'Welt'
        ELSE title
      END,
      generator_meta = CASE
        WHEN COALESCE(generator_meta->'unifiedCanvas'->>'demoSeed', 'true') = 'true'
             AND COALESCE(jsonb_array_length(generator_meta->'unifiedCanvas'->'strokes'), 0) = 0
             AND COALESCE(jsonb_array_length(generator_meta->'unifiedCanvas'->'objects'), 0) = 0
          THEN v_meta
        WHEN generator_meta->'unifiedCanvas' IS NULL
          THEN v_meta
        WHEN COALESCE(generator_meta->>'seed', '') IN (
          'dornhain.unified.v1',
          'dornhain.unified.v2',
          'dornhain.unified.v3'
        )
          THEN v_meta
        ELSE generator_meta
      END,
      updated_at = NOW()
    WHERE id = v_root;
  END IF;

  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES (p_world_profile_id, NULL, 'settlement', 'Dornhain', 'Stadt in Donalu — Starterschauplatz', 'canonical', 'place.dornhain', 10)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE
    SET name = EXCLUDED.name, kind = EXCLUDED.kind, status = EXCLUDED.status, description = EXCLUDED.description;
  SELECT id INTO v_dornhain FROM public.world_places
  WHERE world_profile_id = p_world_profile_id AND seed_key = 'place.dornhain';

  INSERT INTO public.world_places (world_profile_id, parent_place_id, kind, name, description, status, seed_key, sort_order)
  VALUES
    (p_world_profile_id, v_dornhain, 'building', 'Taverne Zum Flüstern', 'Treffpunkt der Helden', 'canonical', 'loc.tavern', 20),
    (p_world_profile_id, v_dornhain, 'site', 'Marktplatz Dornhain', 'Gerüchte und Handel', 'canonical', 'loc.market', 30),
    (p_world_profile_id, v_dornhain, 'area', 'Schattenwald', 'Wald vor den Toren', 'canonical', 'loc.woods', 40),
    (p_world_profile_id, v_dornhain, 'dungeon', 'Krypta unter dem Hügel', 'GM-only Reliktort', 'canonical', 'loc.crypt', 50),
    (p_world_profile_id, v_dornhain, 'site', 'Banditenlager (falsche Spur)', 'Ablenkung', 'canonical', 'loc.bandit-camp', 60)
  ON CONFLICT (world_profile_id, seed_key) DO UPDATE SET
    parent_place_id = COALESCE(EXCLUDED.parent_place_id, public.world_places.parent_place_id),
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    description = COALESCE(EXCLUDED.description, public.world_places.description),
    status = EXCLUDED.status;

  SELECT id INTO v_settlement
  FROM public.world_atlas_maps
  WHERE world_profile_id = p_world_profile_id
    AND kind = 'settlement'
    AND (title ILIKE '%Dornhain%' OR generator_meta->>'placeSeedKey' = 'place.dornhain')
  ORDER BY sort_order
  LIMIT 1;

  IF v_settlement IS NULL THEN
    INSERT INTO public.world_atlas_maps (
      world_profile_id, parent_map_id, kind, title, sort_order, bounds, generator_meta
    ) VALUES (
      p_world_profile_id, v_root, 'settlement', 'Dornhain (Stadt)', 20,
      '{"minX":0,"minY":0,"maxX":400,"maxY":400}'::jsonb,
      jsonb_build_object(
        'engine', 'unified_canvas',
        'placeSeedKey', 'place.dornhain',
        'unifiedCanvas', jsonb_build_object(
          'format', 'sagatree-unified-atlas-v1',
          'demoSeed', false,
          'layers', jsonb_build_object(
            'terrain', true, 'roads', true, 'region', true, 'city', true,
            'interior', true, 'drawings', true, 'objects', true, 'grid', false
          ),
          'strokes', '[]'::jsonb,
          'objects', '[]'::jsonb,
          'rooms', '[]'::jsonb,
          'walls', '[]'::jsonb
        )
      )
    )
    RETURNING id INTO v_settlement;
  END IF;

  IF to_regclass('public.world_place_map_links') IS NOT NULL AND v_dornhain IS NOT NULL AND v_root IS NOT NULL THEN
    INSERT INTO public.world_place_map_links (world_profile_id, place_id, map_id, usage, anchor)
    VALUES (
      p_world_profile_id, v_dornhain, v_root, 'overview',
      '{"x":360,"y":510,"source":"dornhain.unified.v3"}'::jsonb
    )
    ON CONFLICT (place_id, map_id, usage) DO UPDATE
      SET anchor = EXCLUDED.anchor;

    IF v_settlement IS NOT NULL THEN
      INSERT INTO public.world_place_map_links (world_profile_id, place_id, map_id, usage)
      VALUES (p_world_profile_id, v_dornhain, v_settlement, 'footprint')
      ON CONFLICT (place_id, map_id, usage) DO NOTHING;
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_dornhain_unified_atlas(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_dornhain_unified_atlas(UUID) TO service_role;

-- Re-seed Dornhain worlds still on v1/v2 or legacy titles.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT wp.id AS world_id
    FROM public.world_profiles wp
    JOIN public.world_atlas_maps m ON m.world_profile_id = wp.id AND m.kind = 'world'
    WHERE COALESCE(m.generator_meta->>'seed', '') IN ('dornhain.unified.v1', 'dornhain.unified.v2')
       OR m.title ILIKE '%Dornhain Übersicht%'
       OR m.title IN ('Weltkarte', 'Weltkarte (Unified)')
       OR m.generator_meta->>'sagaSlug' = 'dornhain.whisper'
  LOOP
    PERFORM public.seed_dornhain_unified_atlas(r.world_id);
  END LOOP;
END $$;
