-- 089: GM Earthspirit is presence, not a playable PC — hide from library/join pickers.
-- Extends characters.character_type with gm_presence; reclassifies seeded rows.

ALTER TABLE public.characters
  DROP CONSTRAINT IF EXISTS characters_character_type_check;

ALTER TABLE public.characters
  ADD CONSTRAINT characters_character_type_check
  CHECK (character_type IN ('pc', 'npc', 'companion', 'monster', 'gm_presence'));

UPDATE public.characters c
SET
  character_type = 'gm_presence',
  attributes = COALESCE(c.attributes, '{}'::jsonb) || jsonb_build_object(
    'nativeAssetId', 'gm.earthspirit',
    'gmPresence', true
  ),
  updated_at = NOW()
WHERE c.attributes->>'nativeAssetId' = 'gm.earthspirit'
   OR (
     lower(c.name) IN ('kosmischer erdgeist', 'erdgeist')
     AND lower(COALESCE(c.class, '')) = 'weltgeist'
   );

CREATE OR REPLACE FUNCTION public.seed_dornhain_gm_presence_character(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  IF p_project_id IS NULL OR p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.characters c
    WHERE c.owner_user_id = p_user_id
      AND (
        c.attributes->>'nativeAssetId' = 'gm.earthspirit'
        OR (
          lower(c.name) IN ('kosmischer erdgeist', 'erdgeist')
          AND COALESCE(c.project_id, p_project_id) = p_project_id
        )
      )
  ) INTO v_exists;

  IF v_exists THEN
    UPDATE public.characters c
    SET
      project_id = COALESCE(c.project_id, p_project_id),
      name = 'Kosmischer Erdgeist',
      description = COALESCE(
        NULLIF(BTRIM(c.description), ''),
        'GM-Presence · Kosmischer Erdgeist'
      ),
      class = COALESCE(NULLIF(BTRIM(c.class), ''), 'Weltgeist'),
      character_type = 'gm_presence',
      portrait_url = COALESCE(
        NULLIF(BTRIM(c.portrait_url), ''),
        '/assets/session/gm-earthspirit.jpg?v=1'
      ),
      attributes = COALESCE(c.attributes, '{}'::jsonb) || jsonb_build_object(
        'nativeAssetId', 'gm.earthspirit',
        'gmPresence', true
      ),
      updated_at = NOW()
    WHERE c.owner_user_id = p_user_id
      AND (
        c.attributes->>'nativeAssetId' = 'gm.earthspirit'
        OR (
          lower(c.name) IN ('kosmischer erdgeist', 'erdgeist')
          AND COALESCE(c.project_id, p_project_id) = p_project_id
        )
      );
    RETURN 0;
  END IF;

  INSERT INTO public.characters (
    owner_user_id,
    project_id,
    name,
    description,
    class,
    race,
    level,
    ruleset_key,
    attributes,
    skills,
    inventory,
    character_type,
    sheet_status,
    portrait_url,
    sagatree_profile
  ) VALUES (
    p_user_id,
    p_project_id,
    'Kosmischer Erdgeist',
    'GM-Presence · Kosmischer Erdgeist',
    'Weltgeist',
    'human',
    1,
    'sagatree-core',
    jsonb_build_object(
      'strength', 2,
      'dexterity', 2,
      'endurance', 3,
      'mind', 4,
      'perception', 3,
      'charisma', 3,
      'nativeAssetId', 'gm.earthspirit',
      'gmPresence', true,
      'nativeStarterSheetVersion', 1
    ),
    '{}'::jsonb,
    '[]'::jsonb,
    'gm_presence',
    'complete',
    '/assets/session/gm-earthspirit.jpg?v=1',
    jsonb_build_object(
      'nativeAssetId', 'gm.earthspirit',
      'gmPresence', true,
      'nativeStarterSheetVersion', 1
    )
  );

  RETURN 1;
END;
$$;

COMMENT ON FUNCTION public.seed_dornhain_gm_presence_character(UUID, UUID) IS
  'Idempotent: create/update Kosmischer Erdgeist as character_type=gm_presence (not a library PC).';
