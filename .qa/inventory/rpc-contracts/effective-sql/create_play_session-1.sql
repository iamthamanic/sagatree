-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.create_play_session(p_project_id uuid, p_name text = NULL) RETURNS public.sessions LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE actor UUID := auth.uid(); created public.sessions;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_project_id IS NULL THEN RAISE EXCEPTION 'project_id required' USING ERRCODE = '22023'; END IF;
  IF NOT public.is_project_gm(p_project_id, actor) THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  INSERT INTO public.sessions (project_id, session_number, name, status, code)
  VALUES (p_project_id, public.allocate_next_session_number(p_project_id), NULLIF(BTRIM(p_name), ''), 'waiting', public.generate_unique_session_code())
  RETURNING * INTO created;
  RETURN created;
END;
$$;
