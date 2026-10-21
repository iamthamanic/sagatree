-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.update_npc_creature_instance_runtime(p_instance_id uuid, p_runtime jsonb) RETURNS public.npc_creature_instances LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_row public.npc_creature_instances;
  v_actor UUID;
BEGIN
  IF p_instance_id IS NULL THEN
    RAISE EXCEPTION 'missing instance';
  END IF;

  IF jsonb_typeof(p_runtime) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid runtime';
  END IF;

  SELECT * INTO v_row
  FROM public.npc_creature_instances
  WHERE id = p_instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'instance not found';
  END IF;

  v_actor := public.assert_npc_creature_instance_gm(v_row.project_id);

  IF p_runtime ? 'temporaryControllerUserId'
     AND jsonb_typeof(p_runtime->'temporaryControllerUserId') = 'string'
     AND btrim(p_runtime->>'temporaryControllerUserId') <> '' THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.project_members pm
      WHERE pm.project_id = v_row.project_id
        AND pm.user_id = (p_runtime->>'temporaryControllerUserId')::uuid
        AND pm.status = 'active'
    ) THEN
      RAISE EXCEPTION 'temporary controller is not an active project member';
    END IF;
  END IF;

  -- Snapshot column intentionally untouched.
  UPDATE public.npc_creature_instances
  SET runtime = p_runtime,
      updated_at = NOW()
  WHERE id = p_instance_id
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
