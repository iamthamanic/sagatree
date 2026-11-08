-- Harden character_presets client writes: own source_character only, origin=user.
-- System presets (origin=system) are service-role seeded later (RLS bypass); clients cannot invent them.

DROP POLICY IF EXISTS "Owners insert own character presets" ON public.character_presets;
DROP POLICY IF EXISTS "Owners update own character presets" ON public.character_presets;

CREATE POLICY "Owners insert own character presets"
  ON public.character_presets
  FOR INSERT
  WITH CHECK (
    owner_user_id = auth.uid()
    AND published = FALSE
    AND origin = 'user'
    AND (
      source_character_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.characters c
        WHERE c.id = source_character_id
          AND c.owner_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Owners update own character presets"
  ON public.character_presets
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (
    owner_user_id = auth.uid()
    AND published = FALSE
    AND origin = 'user'
    AND (
      source_character_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.characters c
        WHERE c.id = source_character_id
          AND c.owner_user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_character_preset_owner_retarget()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'character_presets.owner_user_id is immutable';
  END IF;
  IF NEW.origin IS DISTINCT FROM OLD.origin THEN
    RAISE EXCEPTION 'character_presets.origin is immutable';
  END IF;
  IF NEW.published IS DISTINCT FROM FALSE THEN
    RAISE EXCEPTION 'character_presets.published must remain false in MVP';
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON POLICY "Owners insert own character presets" ON public.character_presets IS
  'Owner insert only; origin must be user; source_character_id null or owned by auth.uid().';

COMMENT ON POLICY "Owners update own character presets" ON public.character_presets IS
  'Owner update only; origin must stay user; source_character_id null or owned by auth.uid().';
