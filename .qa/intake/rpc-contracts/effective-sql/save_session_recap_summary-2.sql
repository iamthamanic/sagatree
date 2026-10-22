-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.save_session_recap_summary(p_session_id uuid, p_summary_text text, p_status text = 'draft') RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.sessions%ROWTYPE;
  v_status TEXT := lower(btrim(COALESCE(p_status, 'draft')));
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;
  IF v_status NOT IN ('draft', 'approved', 'none') THEN
    RAISE EXCEPTION 'invalid summary status' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT public.is_project_gm(v_session.project_id, v_user) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.session_recaps (session_id, summary_text, summary_status, highlight_lines, snapshot)
  VALUES (
    p_session_id,
    NULLIF(BTRIM(COALESCE(p_summary_text, '')), ''),
    v_status,
    '[]'::jsonb,
    '{}'::jsonb
  )
  ON CONFLICT (session_id) DO UPDATE
    SET summary_text = EXCLUDED.summary_text,
        summary_status = EXCLUDED.summary_status,
        updated_at = NOW();

  RETURN public.get_session_recap(p_session_id);
END;
$$;
