-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_session_recap(p_session_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_user UUID := auth.uid();
  v_session public.sessions%ROWTYPE;
  v_is_gm BOOLEAN;
  v_recap public.session_recaps%ROWTYPE;
  v_lines JSONB;
  v_adv JSONB;
  v_summary TEXT;
  v_status TEXT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_session FROM public.sessions WHERE id = p_session_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT public.is_session_participant(p_session_id, v_user) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  v_is_gm := public.is_project_gm(v_session.project_id, v_user);

  SELECT * INTO v_recap FROM public.session_recaps WHERE session_id = p_session_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_adv := COALESCE(v_recap.snapshot, '{}'::jsonb);
  v_lines := public.sagatree_build_recap_highlight_lines(v_adv, v_is_gm);
  v_status := COALESCE(v_recap.summary_status, 'none');
  v_summary := v_recap.summary_text;

  IF NOT v_is_gm AND v_status IS DISTINCT FROM 'approved' THEN
    v_summary := NULL;
  END IF;

  RETURN jsonb_build_object(
    'sessionId', v_recap.session_id,
    'summaryText', v_summary,
    'summaryStatus', v_status,
    'highlightLines', v_lines,
    'createdAt', v_recap.created_at,
    'updatedAt', v_recap.updated_at
  );
END;
$$;
