-- #143: Adventure members / GM must read world_profiles.modules so Character
-- Inventory can compose the item-catalog add surface. Write stays owner-only.
-- current_user_can_read_world_profile (migration 015) already covers owner +
-- adventure GM/members and is SECURITY DEFINER (no RLS recursion).

DROP POLICY IF EXISTS "Users can view their world profiles" ON public.world_profiles;

CREATE POLICY "Users can view readable world profiles" ON public.world_profiles
  FOR SELECT
  USING (public.current_user_can_read_world_profile(id));
