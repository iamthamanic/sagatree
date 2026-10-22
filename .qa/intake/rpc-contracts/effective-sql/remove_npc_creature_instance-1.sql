-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION public.remove_npc_creature_instance(p_instance_id uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'pg_temp' AS $$
DECLARE
  v_row public.npc_creature_instances;
BEGIN
  IF p_instance_id IS NULL THEN
    RAISE EXCEPTION 'missing instance';
  END IF;

  SELECT * INTO v_row
  FROM public.npc_creature_instances
  WHERE id = p_instance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'instance not found';
  END IF;

  PERFORM public.assert_npc_creature_instance_gm(v_row.project_id);

  DELETE FROM public.npc_creature_instances WHERE id = p_instance_id;
  RETURN p_instance_id;
END;
$$;
