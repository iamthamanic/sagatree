-- Harden world_places / map_links SELECT: non-editors must use list_* RPCs
-- (SECURITY DEFINER + party projection). Direct PostgREST SELECT must not
-- leak gm_only / unbound places to saga members who can only read the profile.

DROP POLICY IF EXISTS "world_places_select" ON public.world_places;
CREATE POLICY "world_places_select" ON public.world_places
  FOR SELECT TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id));

DROP POLICY IF EXISTS "world_place_map_links_select" ON public.world_place_map_links;
CREATE POLICY "world_place_map_links_select" ON public.world_place_map_links
  FOR SELECT TO authenticated
  USING (public.current_user_can_edit_world_profile(world_profile_id));
