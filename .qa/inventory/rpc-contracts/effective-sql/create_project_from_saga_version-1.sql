-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.create_project_from_saga_version(p_saga_id uuid, p_version_id uuid, p_name text = NULL) RETURNS public.projects LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  actor UUID := auth.uid();
  v_def public.saga_definitions%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  created public.projects;
  v_name TEXT;
  v_adv JSONB := '{}'::jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501'; END IF;

  SELECT * INTO v_def FROM public.saga_definitions WHERE id = p_saga_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Saga not found' USING ERRCODE = 'P0002'; END IF;
  SELECT * INTO v_ver FROM public.saga_definition_versions
   WHERE id = p_version_id AND saga_id = p_saga_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fassung not found' USING ERRCODE = 'P0002'; END IF;
  IF v_ver.status <> 'published' THEN
    RAISE EXCEPTION 'Nur veröffentlichte Fassungen' USING ERRCODE = '22023';
  END IF;

  IF v_def.origin NOT IN ('native', 'user') AND v_def.owner_user_id IS DISTINCT FROM actor THEN
    -- private_backfill: only owner may spawn another group
    IF v_def.owner_user_id IS DISTINCT FROM actor THEN
      RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_name := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  IF v_name IS NULL THEN
    v_name := v_def.title || ' · Gruppe';
  END IF;

  IF jsonb_typeof(v_ver.payload->'initialAdventure') = 'object' THEN
    v_adv := v_ver.payload->'initialAdventure';
  END IF;

  INSERT INTO public.projects (
    code, name, description, gm_user_id, status, saga_id, saga_version_id, adventure_runtime
  ) VALUES (
    NULL, -- trigger generate_project_code
    v_name,
    v_def.synopsis,
    actor,
    'active',
    v_def.id,
    v_ver.id,
    v_adv
  )
  RETURNING * INTO created;

  INSERT INTO public.project_members (project_id, user_id, role, status)
  VALUES (created.id, actor, 'gm', 'active');

  RETURN created;
END;
$$;
