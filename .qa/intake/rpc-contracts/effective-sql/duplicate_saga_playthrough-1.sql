-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.duplicate_saga_playthrough(p_project_id uuid, p_mode text = 'fresh') RETURNS TABLE (id uuid, public_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  actor UUID := auth.uid();
  src public.projects%ROWTYPE;
  v_ver public.saga_definition_versions%ROWTYPE;
  created public.projects%ROWTYPE;
  v_mode TEXT := lower(btrim(coalesce(p_mode, 'fresh')));
  v_name TEXT;
  v_adv JSONB := '{}'::jsonb;
BEGIN
  IF actor IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  IF v_mode NOT IN ('fresh', 'with_progress') THEN
    RAISE EXCEPTION 'Ungültiger Duplikat-Modus' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO src
  FROM public.projects
  WHERE public.projects.id = p_project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saga nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  IF src.gm_user_id IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'Nur der Gamemaster kann duplizieren' USING ERRCODE = '42501';
  END IF;

  IF src.saga_id IS NULL OR src.saga_version_id IS NULL THEN
    RAISE EXCEPTION 'Diese Saga hat keine Fassung' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ver
  FROM public.saga_definition_versions
  WHERE public.saga_definition_versions.id = src.saga_version_id
    AND public.saga_definition_versions.saga_id = src.saga_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fassung nicht gefunden' USING ERRCODE = 'P0002';
  END IF;

  v_name := btrim(coalesce(src.name, '')) || ' · Kopie';
  IF length(v_name) > 120 THEN
    v_name := left(btrim(coalesce(src.name, 'Saga')), 110) || ' · Kopie';
  END IF;

  IF v_mode = 'with_progress' THEN
    v_adv := coalesce(src.adventure_runtime, '{}'::jsonb);
  ELSIF jsonb_typeof(v_ver.payload->'initialAdventure') = 'object' THEN
    v_adv := v_ver.payload->'initialAdventure';
  END IF;

  INSERT INTO public.projects (
    code,
    name,
    description,
    gm_user_id,
    status,
    saga_id,
    saga_version_id,
    adventure_runtime
  ) VALUES (
    NULL,
    v_name,
    src.description,
    actor,
    'active',
    src.saga_id,
    src.saga_version_id,
    v_adv
  )
  RETURNING * INTO created;

  INSERT INTO public.project_members (project_id, user_id, role, status)
  VALUES (created.id, actor, 'gm', 'active')
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    role = 'gm',
    status = 'active';

  RETURN QUERY SELECT created.id, created.public_id;
END;
$$;
