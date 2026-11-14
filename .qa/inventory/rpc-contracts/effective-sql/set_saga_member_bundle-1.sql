-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.set_saga_member_bundle(p_project_id uuid, p_member_id uuid, p_bundle_id text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_member RECORD;
  v_governance_left INT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.has_saga_permission(p_project_id, 'saga.members.set_bundle')
     AND NOT public.is_project_gm(p_project_id, v_uid) THEN
    RAISE EXCEPTION 'missing saga.members.set_bundle';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.saga_permission_bundles WHERE id = p_bundle_id) THEN
    RAISE EXCEPTION 'unknown bundle %', p_bundle_id;
  END IF;

  SELECT * INTO v_member
  FROM public.project_members
  WHERE id = p_member_id AND project_id = p_project_id AND status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'member not found';
  END IF;

  -- Invariant: cannot demote last holder of set_bundle away from GM bundle.
  IF p_bundle_id <> 'bundle.saga.gm' THEN
    SELECT COUNT(DISTINCT g.user_id) INTO v_governance_left
    FROM public.project_member_saga_grants g
    JOIN public.project_members m ON m.id = g.member_id
    WHERE g.project_id = p_project_id
      AND g.permission_key = 'saga.members.set_bundle'
      AND m.status = 'active'
      AND g.member_id <> p_member_id;
    IF COALESCE(v_governance_left, 0) < 1
       AND EXISTS (
         SELECT 1 FROM public.project_member_saga_grants
         WHERE member_id = p_member_id AND permission_key = 'saga.members.set_bundle'
       ) THEN
      RAISE EXCEPTION 'cannot revoke last saga.members.set_bundle grant';
    END IF;
  END IF;

  DELETE FROM public.project_member_saga_grants WHERE member_id = p_member_id;

  INSERT INTO public.project_member_saga_grants (
    project_id, member_id, user_id, permission_key, source_bundle_id, granted_by
  )
  SELECT
    p_project_id,
    p_member_id,
    v_member.user_id,
    bk.permission_key,
    p_bundle_id,
    v_uid
  FROM public.saga_permission_bundle_keys bk
  WHERE bk.bundle_id = p_bundle_id;

  INSERT INTO public.project_member_saga_bundles (
    member_id, project_id, user_id, bundle_id, assigned_by, updated_at
  ) VALUES (
    p_member_id, p_project_id, v_member.user_id, p_bundle_id, v_uid, NOW()
  )
  ON CONFLICT (member_id) DO UPDATE SET
    bundle_id = EXCLUDED.bundle_id,
    assigned_by = EXCLUDED.assigned_by,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'memberId', p_member_id,
    'bundleId', p_bundle_id,
    'grantCount', (
      SELECT COUNT(*)::INT FROM public.project_member_saga_grants WHERE member_id = p_member_id
    )
  );
END;
$$;
