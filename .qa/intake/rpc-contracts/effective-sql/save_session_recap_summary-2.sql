-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.save_session_recap_summary(p_session_id uuid, p_summary_text text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  RETURN public.save_session_recap_summary(p_session_id, p_summary_text, 'draft');
END;
$$;
