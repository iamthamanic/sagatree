-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.list_saga_member_permission_state(p_public_id text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_project_id UUID;
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO v_project_id
  FROM public.projects
  WHERE public_id = UPPER(BTRIM(p_public_id));

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'saga not found';
  END IF;

  IF NOT public.has_saga_permission(v_project_id, 'saga.members.read')
     AND NOT public.is_project_gm(v_project_id, v_uid) THEN
    RAISE EXCEPTION 'missing saga.members.read';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'memberId', m.id,
        'userId', m.user_id,
        'role', m.role,
        'status', m.status,
        'bundleId', b.bundle_id,
        'canSetBundle', public.has_saga_permission(v_project_id, 'saga.members.set_bundle')
          OR public.is_project_gm(v_project_id, v_uid)
      )
      ORDER BY m.joined_at
    )
    FROM public.project_members m
    LEFT JOIN public.project_member_saga_bundles b ON b.member_id = m.id
    WHERE m.project_id = v_project_id AND m.status = 'active'
  ), '[]'::jsonb);
END;
$$;
