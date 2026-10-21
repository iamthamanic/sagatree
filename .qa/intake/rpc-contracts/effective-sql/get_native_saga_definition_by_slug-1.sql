-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.get_native_saga_definition_by_slug(p_slug text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_ver_id UUID;
BEGIN
  SELECT v.id INTO v_ver_id
  FROM public.saga_definitions d
  JOIN public.saga_definition_versions v ON v.saga_id = d.id
  WHERE d.slug = BTRIM(p_slug)
    AND d.origin = 'native'
    AND v.status = 'published'
  ORDER BY v.published_at DESC NULLS LAST
  LIMIT 1;
  IF v_ver_id IS NULL THEN
    RAISE EXCEPTION 'Native Saga nicht gefunden' USING ERRCODE = 'P0002';
  END IF;
  RETURN public.get_saga_definition_version(v_ver_id);
END;
$$;
