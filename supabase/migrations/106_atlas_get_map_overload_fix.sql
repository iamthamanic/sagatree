-- #721: remove ambiguous get_world_atlas_map(uuid, boolean) wrapper.
-- The 3-arg function already defaults p_saga_public_id; a parallel 2-arg
-- overload made PostgREST/SQL calls with two arguments fail with
-- "function is not unique". Expand-only: drop the redundant wrapper only.

DROP FUNCTION IF EXISTS public.get_world_atlas_map(UUID, BOOLEAN);

REVOKE ALL ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_world_atlas_map(UUID, BOOLEAN, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
