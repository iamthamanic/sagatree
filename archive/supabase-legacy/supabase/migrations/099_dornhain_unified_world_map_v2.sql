-- #dornhain-unified-atlas-v2 — World-scale ocean + continents (not settlement floorplan).
-- Upgrades seed dornhain.unified.v1 → v2; renames root title to Weltkarte.

CREATE OR REPLACE FUNCTION public.build_dornhain_unified_generator_meta()
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT $dornhain_meta${"engine":"unified_canvas","sagaSlug":"dornhain.whisper","seed":"dornhain.unified.v2","scale":"world","unifiedCanvas":{"format":"sagatree-unified-atlas-v1","layers":{"terrain":true,"roads":true,"region":true,"city":true,"interior":true,"drawings":true,"objects":true,"grid":false},"strokes":[{"id":"w.river-w","material":"wasser","width":10,"points":[[220,120],[240,280],[210,420],[250,560],[200,720]]},{"id":"w.river-e","material":"wasser","width":12,"points":[[780,80],[760,220],[800,400],[740,580],[780,760]]},{"id":"s.rd.plaza","material":"pflaster","width":9,"points":[[330,530],[350,510],[370,490]]}],"objects":[{"id":"w.loc.dornhain","type":"haus","x":360,"y":510,"size":0.42,"height":1.2},{"id":"w.loc.northkeep","type":"turm","x":220,"y":160,"size":0.36,"height":1.4},{"id":"w.loc.eastport","type":"haus","x":820,"y":480,"size":0.38,"height":1.1},{"id":"w.loc.southmarsh","type":"fels","x":180,"y":720,"size":0.34},{"id":"w.loc.highpass","type":"fels","x":700,"y":120,"size":0.32},{"id":"s.obj.tavern","type":"haus","x":328,"y":528,"size":0.55,"height":1.2},{"id":"s.obj.market","type":"haus","x":378,"y":488,"size":0.5,"height":1.1},{"id":"s.obj.woods","type":"tanne","x":410,"y":550,"size":0.65},{"id":"s.obj.crypt","type":"fels","x":406,"y":462,"size":0.55},{"id":"s.obj.tree-a","type":"baum","x":304,"y":460,"size":0.4},{"id":"s.obj.tree-b","type":"tanne","x":420,"y":500,"size":0.45}],"rooms":[{"id":"w.ocean","material":"wasser","x":0,"y":0,"w":1000,"h":1000},{"id":"w.west-core","material":"gras","x":60,"y":180,"w":380,"h":520},{"id":"w.west-north","material":"erde","x":100,"y":90,"w":280,"h":160},{"id":"w.west-south","material":"sand","x":80,"y":640,"w":300,"h":180},{"id":"w.west-pen","material":"gras","x":300,"y":400,"w":140,"h":200},{"id":"w.east-core","material":"gras","x":520,"y":140,"w":400,"h":560},{"id":"w.east-north","material":"stein","x":580,"y":40,"w":300,"h":160},{"id":"w.east-south","material":"erde","x":560,"y":640,"w":320,"h":220},{"id":"w.east-bay","material":"sand","x":480,"y":360,"w":100,"h":140},{"id":"w.isle-n","material":"holz","x":420,"y":30,"w":120,"h":90},{"id":"w.isle-sw","material":"gras","x":40,"y":780,"w":100,"h":120},{"id":"w.isle-se","material":"sand","x":860,"y":820,"w":110,"h":100},{"id":"w.lake-w","material":"wasser","x":180,"y":320,"w":70,"h":50},{"id":"w.lake-e","material":"wasser","x":700,"y":280,"w":90,"h":60},{"id":"s.ground","material":"gras","x":280,"y":430,"w":160,"h":160},{"id":"s.plaza","material":"pflaster","x":320,"y":480,"w":70,"h":60},{"id":"s.tavern","material":"erde","x":310,"y":510,"w":36,"h":36},{"id":"s.market","material":"sand","x":360,"y":470,"w":36,"h":36},{"id":"s.woods","material":"holz","x":390,"y":530,"w":40,"h":40},{"id":"s.crypt","material":"stein","x":390,"y":446,"w":32,"h":32}],"walls":[],"demoSeed":false}}$dornhain_meta$::jsonb;
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
      p_world_profile_id, NULL, 'world', 'Weltkarte', 10,
      '{"minX":0,"minY":0,"maxX":1000,"maxY":1000}'::jsonb,
      v_meta
    )
    RETURNING id INTO v_root;
  ELSE
    UPDATE public.world_atlas_maps
    SET
      title = CASE
        WHEN title IN (
          'Weltkarte (Unified)',
          'Kachelkarte (Legacy)',
          'Dornhain Übersicht (Unified)'
        ) OR btrim(title) = '' THEN 'Weltkarte'
        ELSE title
      END,
      generator_meta = CASE
        WHEN COALESCE(generator_meta->'unifiedCanvas'->>'demoSeed', 'true') = 'true'
             AND COALESCE(jsonb_array_length(generator_meta->'unifiedCanvas'->'strokes'), 0) = 0
             AND COALESCE(jsonb_array_length(generator_meta->'unifiedCanvas'->'objects'), 0) = 0
          THEN v_meta
        WHEN generator_meta->'unifiedCanvas' IS NULL
          THEN v_meta
        WHEN COALESCE(generator_meta->>'seed', '') IN ('dornhain.unified.v1', 'dornhain.unified.v2')
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
          'objects', jsonb_build_array(
            jsonb_build_object('id', 'city.tavern', 'type', 'haus', 'x', 120, 'y', 200, 'size', 3.2, 'height', 22),
            jsonb_build_object('id', 'city.market', 'type', 'haus', 'x', 220, 'y', 160, 'size', 3.0, 'height', 18),
            jsonb_build_object('id', 'city.tree', 'type', 'baum', 'x', 300, 'y', 260, 'size', 2.0)
          ),
          'rooms', jsonb_build_array(
            jsonb_build_object('id', 'city.ground', 'material', 'gras', 'x', 0, 'y', 0, 'w', 400, 'h', 400),
            jsonb_build_object('id', 'city.plaza', 'material', 'pflaster', 'x', 80, 'y', 120, 'w', 200, 'h', 160)
          ),
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
      '{"x":360,"y":510,"source":"dornhain.unified.v2"}'::jsonb
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

-- Re-seed all Dornhain worlds that still carry v1 / Übersicht starter.
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
       OR m.generator_meta->>'sagaSlug' = 'dornhain.whisper'
  LOOP
    PERFORM public.seed_dornhain_unified_atlas(r.world_id);
  END LOOP;
END $$;
