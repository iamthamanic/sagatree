-- 082: Dornhain native pregens as full SagaTree Core sheets
-- (race / archetype / essence / species traits / skill provenance).
-- Replaces thin seed (race Mensch + empty profile) so Character Editor opens selected.

CREATE OR REPLACE FUNCTION public.seed_dornhain_starter_characters(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT := 0;
  r RECORD;
  v_match BOOLEAN;
BEGIN
  IF p_project_id IS NULL OR p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      (
        'pregen.warrior',
        'Brenna Sturmfaust',
        'Kämpferin',
        'dwarf',
        2,
        '{"strength":4,"dexterity":3,"endurance":3,"mind":1,"perception":2,"charisma":2,"nativeAssetId":"pregen.warrior","nativeStarterSheetVersion":1}'::jsonb,
        '{"athletics":3,"acrobatics":1,"sleight":0,"stealth":0,"melee":3,"ranged":0,"awareness":1,"insight":0,"survival":0,"investigation":0,"knowledge":0,"technology":0,"medicine":0,"driving":0,"persuasion":0,"deception":0,"intimidation":2,"performance":0}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.longsword","builtin.fantasy.rope"]'::jsonb,
        '{"archetype":"fighter","essence":"physical","speciesTraitInstances":[{"trait":"natural-protection","source":"species-creation","acquiredAtLevel":1},{"trait":"sharpened-sense","source":"species-creation","acquiredAtLevel":1,"option":"sense-hearing"}],"backgroundTemplateId":"sport-competition","background":{"name":"Sport & Wettkampf","skillPool":["athletics","acrobatics","awareness","performance"],"trainedSkills":["athletics"],"backgroundSkillPoints":{"athletics":2},"specialization":{"skill":"athletics","name":"Kraftakt","source":"background","acquiredAtLevel":1},"milieuAccess":"Arenen & Zwergenhallen","contact":"Waffenmeisterin aus dem Clan","complication":"Alte Blutschuld","communication":"Kampfzeichen"},"archetypeTrainingSkill":"melee","freeSkillRanks":{"melee":2,"intimidation":2,"athletics":1,"awareness":1,"acrobatics":1},"specializations":[{"skill":"athletics","name":"Kraftakt","source":"background","acquiredAtLevel":1}],"baseAttributes":{"strength":4,"dexterity":3,"endurance":3,"mind":1,"perception":2,"charisma":2},"nativeStarterSheetVersion":1,"drive":3,"momentum":0,"attributeAdvances":{}}'::jsonb
      ),
      (
        'pregen.scout',
        'Kael Schattenpfad',
        'Späher',
        'orc',
        2,
        '{"strength":1,"dexterity":4,"endurance":3,"mind":2,"perception":3,"charisma":2,"nativeAssetId":"pregen.scout","nativeStarterSheetVersion":1}'::jsonb,
        '{"athletics":0,"acrobatics":2,"sleight":2,"stealth":3,"melee":0,"ranged":0,"awareness":1,"insight":0,"survival":0,"investigation":0,"knowledge":0,"technology":0,"medicine":0,"driving":0,"persuasion":0,"deception":2,"intimidation":0,"performance":0}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.shortbow","builtin.fantasy.lockpicks"]'::jsonb,
        '{"archetype":"rebel","essence":"physical","speciesTraitInstances":[{"trait":"natural-protection","source":"species-creation","acquiredAtLevel":1},{"trait":"natural-weapon","source":"species-creation","acquiredAtLevel":1}],"backgroundTemplateId":"smuggler","background":{"name":"Unterwelt & Grauzone","skillPool":["driving","deception","stealth","sleight"],"trainedSkills":["stealth","deception"],"backgroundSkillPoints":{"stealth":1,"deception":1},"specialization":{"skill":"stealth","name":"Urbane Tarnung","source":"background","acquiredAtLevel":1},"milieuAccess":"Randgebiete & Schleichwege","contact":"Schmugglerin an der Grenze","complication":"Teufelsauge — Markenzeichen und Gefahr","communication":"Handzeichen"},"archetypeTrainingSkill":"stealth","freeSkillRanks":{"stealth":1,"sleight":2,"acrobatics":2,"deception":1,"awareness":1},"specializations":[{"skill":"stealth","name":"Urbane Tarnung","source":"background","acquiredAtLevel":1}],"baseAttributes":{"strength":1,"dexterity":4,"endurance":3,"mind":2,"perception":3,"charisma":2},"nativeStarterSheetVersion":1,"drive":3,"momentum":0,"attributeAdvances":{}}'::jsonb
      ),
      (
        'pregen.mystic',
        'Liora Mondschein',
        'Mystikerin',
        'elf',
        2,
        '{"strength":1,"dexterity":2,"endurance":2,"mind":4,"perception":3,"charisma":3,"nativeAssetId":"pregen.mystic","nativeStarterSheetVersion":1}'::jsonb,
        '{"athletics":0,"acrobatics":0,"sleight":0,"stealth":0,"melee":0,"ranged":0,"awareness":2,"insight":1,"survival":0,"investigation":2,"knowledge":3,"technology":0,"medicine":0,"driving":0,"persuasion":2,"deception":0,"intimidation":0,"performance":0}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.quarterstaff","builtin.fantasy.healer-kit"]'::jsonb,
        '{"archetype":"thinker","essence":"spiritual","speciesTraitInstances":[{"trait":"enhanced-sight","source":"species-creation","acquiredAtLevel":1,"option":"darkvision"},{"trait":"low-rest-need","source":"species-creation","acquiredAtLevel":1}],"backgroundTemplateId":"academy-research","background":{"name":"Akademie & Forschung","skillPool":["knowledge","investigation","awareness","persuasion"],"trainedSkills":["knowledge"],"backgroundSkillPoints":{"knowledge":2},"specialization":{"skill":"knowledge","name":"Okkultes","source":"background","acquiredAtLevel":1},"milieuAccess":"Archive & Mondtempel","contact":"Mentorin der Akademie","complication":"Umstrittene Theorie","communication":"Akademischer Fachjargon"},"archetypeTrainingSkill":"knowledge","freeSkillRanks":{"investigation":2,"awareness":2,"persuasion":2,"insight":1},"specializations":[{"skill":"knowledge","name":"Okkultes","source":"background","acquiredAtLevel":1}],"baseAttributes":{"strength":1,"dexterity":2,"endurance":2,"mind":4,"perception":3,"charisma":3},"nativeStarterSheetVersion":1,"drive":3,"momentum":0,"attributeAdvances":{}}'::jsonb
      ),
      (
        'pregen.diplomat',
        'Oskar Federkiel',
        'Diplomat',
        'human',
        2,
        '{"strength":1,"dexterity":2,"endurance":2,"mind":3,"perception":3,"charisma":4,"nativeAssetId":"pregen.diplomat","nativeStarterSheetVersion":1}'::jsonb,
        '{"athletics":0,"acrobatics":0,"sleight":0,"stealth":0,"melee":0,"ranged":0,"awareness":2,"insight":3,"survival":0,"investigation":2,"knowledge":0,"technology":0,"medicine":0,"driving":0,"persuasion":2,"deception":1,"intimidation":0,"performance":0}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.dagger","builtin.fantasy.writing-kit"]'::jsonb,
        '{"archetype":"diplomat","essence":"mental","speciesTraitInstances":[{"trait":"sharpened-sense","source":"species-creation","acquiredAtLevel":1,"option":"sense-sight"},{"trait":"narrow-resistance","source":"species-creation","acquiredAtLevel":1,"option":"poison-toxins"},{"trait":"enduring-organism","source":"species-creation","acquiredAtLevel":1}],"backgroundTemplateId":"investigator","background":{"name":"Ermittlung & Information","skillPool":["investigation","awareness","insight","persuasion"],"trainedSkills":["insight","investigation"],"backgroundSkillPoints":{"insight":1,"investigation":1},"specialization":{"skill":"insight","name":"Lügen erkennen","source":"background","acquiredAtLevel":1},"milieuAccess":"Höfe & Schreibstuben","contact":"Archivarin der Stadt","complication":"Offene Schuld gegenüber einem Gönner","communication":"Diplomatische Formeln"},"archetypeTrainingSkill":"insight","freeSkillRanks":{"insight":1,"persuasion":2,"awareness":2,"deception":1,"investigation":1},"specializations":[{"skill":"insight","name":"Lügen erkennen","source":"background","acquiredAtLevel":1}],"baseAttributes":{"strength":1,"dexterity":2,"endurance":2,"mind":3,"perception":3,"charisma":4},"nativeStarterSheetVersion":1,"drive":3,"momentum":0,"attributeAdvances":{}}'::jsonb
      )
    ) AS t(asset_id, char_name, class_label, race_key, lvl, attrs, skills, inv, profile)
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.owner_user_id = p_user_id
        AND (
          c.attributes->>'nativeAssetId' = r.asset_id
          OR (
            c.name = r.char_name
            AND COALESCE(c.project_id, p_project_id) = p_project_id
            AND c.description LIKE 'Dornhain-Starter%'
          )
        )
    ) INTO v_match;

    IF v_match THEN
      -- Per-row upgrade: only thin stubs (no version + no archetype) get the full sheet.
      -- Customized / already-versioned rows keep their sheet; soft-touch metadata only.
      UPDATE public.characters c
      SET
        project_id = COALESCE(c.project_id, p_project_id),
        class = CASE
          WHEN (
            COALESCE(
              (c.attributes->>'nativeStarterSheetVersion')::int,
              (c.sagatree_profile->>'nativeStarterSheetVersion')::int,
              0
            ) < 1
            AND (
              c.sagatree_profile IS NULL
              OR NULLIF(BTRIM(COALESCE(c.sagatree_profile->>'archetype', '')), '') IS NULL
            )
          ) THEN r.class_label
          ELSE COALESCE(NULLIF(BTRIM(c.class), ''), r.class_label)
        END,
        race = CASE
          WHEN (
            COALESCE(
              (c.attributes->>'nativeStarterSheetVersion')::int,
              (c.sagatree_profile->>'nativeStarterSheetVersion')::int,
              0
            ) < 1
            AND (
              c.sagatree_profile IS NULL
              OR NULLIF(BTRIM(COALESCE(c.sagatree_profile->>'archetype', '')), '') IS NULL
            )
          ) THEN r.race_key
          ELSE COALESCE(NULLIF(BTRIM(c.race), ''), r.race_key)
        END,
        level = CASE
          WHEN (
            COALESCE(
              (c.attributes->>'nativeStarterSheetVersion')::int,
              (c.sagatree_profile->>'nativeStarterSheetVersion')::int,
              0
            ) < 1
            AND (
              c.sagatree_profile IS NULL
              OR NULLIF(BTRIM(COALESCE(c.sagatree_profile->>'archetype', '')), '') IS NULL
            )
          ) THEN r.lvl
          ELSE COALESCE(c.level, r.lvl)
        END,
        ruleset_key = CASE
          WHEN (
            COALESCE(
              (c.attributes->>'nativeStarterSheetVersion')::int,
              (c.sagatree_profile->>'nativeStarterSheetVersion')::int,
              0
            ) < 1
            AND (
              c.sagatree_profile IS NULL
              OR NULLIF(BTRIM(COALESCE(c.sagatree_profile->>'archetype', '')), '') IS NULL
            )
          ) THEN 'sagatree-core'
          ELSE COALESCE(NULLIF(BTRIM(c.ruleset_key), ''), 'sagatree-core')
        END,
        attributes = CASE
          WHEN (
            COALESCE(
              (c.attributes->>'nativeStarterSheetVersion')::int,
              (c.sagatree_profile->>'nativeStarterSheetVersion')::int,
              0
            ) < 1
            AND (
              c.sagatree_profile IS NULL
              OR NULLIF(BTRIM(COALESCE(c.sagatree_profile->>'archetype', '')), '') IS NULL
            )
          ) THEN r.attrs
          ELSE COALESCE(c.attributes, '{}'::jsonb) || jsonb_build_object(
            'nativeAssetId', r.asset_id,
            'nativeStarterSheetVersion',
            COALESCE((c.attributes->>'nativeStarterSheetVersion')::int, 1)
          )
        END,
        skills = CASE
          WHEN (
            COALESCE(
              (c.attributes->>'nativeStarterSheetVersion')::int,
              (c.sagatree_profile->>'nativeStarterSheetVersion')::int,
              0
            ) < 1
            AND (
              c.sagatree_profile IS NULL
              OR NULLIF(BTRIM(COALESCE(c.sagatree_profile->>'archetype', '')), '') IS NULL
            )
          ) THEN r.skills
          ELSE COALESCE(c.skills, r.skills)
        END,
        sagatree_profile = CASE
          WHEN (
            COALESCE(
              (c.attributes->>'nativeStarterSheetVersion')::int,
              (c.sagatree_profile->>'nativeStarterSheetVersion')::int,
              0
            ) < 1
            AND (
              c.sagatree_profile IS NULL
              OR NULLIF(BTRIM(COALESCE(c.sagatree_profile->>'archetype', '')), '') IS NULL
            )
          ) THEN r.profile
          ELSE COALESCE(c.sagatree_profile, r.profile)
        END,
        inventory = CASE
          WHEN jsonb_typeof(c.inventory) = 'array' AND jsonb_array_length(c.inventory) > 0
            THEN c.inventory
          ELSE r.inv
        END,
        sheet_status = 'complete',
        description = COALESCE(
          NULLIF(BTRIM(c.description), ''),
          'Dornhain-Starter · ' || r.class_label
        ),
        updated_at = NOW()
      WHERE c.owner_user_id = p_user_id
        AND (
          c.attributes->>'nativeAssetId' = r.asset_id
          OR (
            c.name = r.char_name
            AND COALESCE(c.project_id, p_project_id) = p_project_id
            AND c.description LIKE 'Dornhain-Starter%'
          )
        );
    ELSE
      INSERT INTO public.characters (
        owner_user_id, project_id, name, description, class, race, level,
        ruleset_key, attributes, skills, inventory, character_type, sheet_status,
        sagatree_profile
      ) VALUES (
        p_user_id,
        p_project_id,
        r.char_name,
        'Dornhain-Starter · ' || r.class_label,
        r.class_label,
        r.race_key,
        r.lvl,
        'sagatree-core',
        r.attrs,
        r.skills,
        r.inv,
        'pc',
        'complete',
        r.profile
      );
    END IF;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_dornhain_starter_characters(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_dornhain_starter_characters(UUID, UUID) TO service_role;

-- One-shot backfill for existing native Dornhain starters across all owners.
UPDATE public.characters AS c
SET
  class = v.class_label,
  race = v.race_key,
  level = v.lvl,
  ruleset_key = 'sagatree-core',
  attributes = v.attrs,
  skills = v.skills,
  sagatree_profile = v.profile,
  sheet_status = 'complete',
  description = COALESCE(NULLIF(BTRIM(c.description), ''), 'Dornhain-Starter · ' || v.class_label),
  inventory = CASE
    WHEN jsonb_typeof(c.inventory) = 'array' AND jsonb_array_length(c.inventory) > 0 THEN c.inventory
    ELSE v.inv
  END,
  updated_at = NOW()
FROM (VALUES
      (
        'pregen.warrior',
        'Brenna Sturmfaust',
        'Kämpferin',
        'dwarf',
        2,
        '{"strength":4,"dexterity":3,"endurance":3,"mind":1,"perception":2,"charisma":2,"nativeAssetId":"pregen.warrior","nativeStarterSheetVersion":1}'::jsonb,
        '{"athletics":3,"acrobatics":1,"sleight":0,"stealth":0,"melee":3,"ranged":0,"awareness":1,"insight":0,"survival":0,"investigation":0,"knowledge":0,"technology":0,"medicine":0,"driving":0,"persuasion":0,"deception":0,"intimidation":2,"performance":0}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.longsword","builtin.fantasy.rope"]'::jsonb,
        '{"archetype":"fighter","essence":"physical","speciesTraitInstances":[{"trait":"natural-protection","source":"species-creation","acquiredAtLevel":1},{"trait":"sharpened-sense","source":"species-creation","acquiredAtLevel":1,"option":"sense-hearing"}],"backgroundTemplateId":"sport-competition","background":{"name":"Sport & Wettkampf","skillPool":["athletics","acrobatics","awareness","performance"],"trainedSkills":["athletics"],"backgroundSkillPoints":{"athletics":2},"specialization":{"skill":"athletics","name":"Kraftakt","source":"background","acquiredAtLevel":1},"milieuAccess":"Arenen & Zwergenhallen","contact":"Waffenmeisterin aus dem Clan","complication":"Alte Blutschuld","communication":"Kampfzeichen"},"archetypeTrainingSkill":"melee","freeSkillRanks":{"melee":2,"intimidation":2,"athletics":1,"awareness":1,"acrobatics":1},"specializations":[{"skill":"athletics","name":"Kraftakt","source":"background","acquiredAtLevel":1}],"baseAttributes":{"strength":4,"dexterity":3,"endurance":3,"mind":1,"perception":2,"charisma":2},"nativeStarterSheetVersion":1,"drive":3,"momentum":0,"attributeAdvances":{}}'::jsonb
      ),
      (
        'pregen.scout',
        'Kael Schattenpfad',
        'Späher',
        'orc',
        2,
        '{"strength":1,"dexterity":4,"endurance":3,"mind":2,"perception":3,"charisma":2,"nativeAssetId":"pregen.scout","nativeStarterSheetVersion":1}'::jsonb,
        '{"athletics":0,"acrobatics":2,"sleight":2,"stealth":3,"melee":0,"ranged":0,"awareness":1,"insight":0,"survival":0,"investigation":0,"knowledge":0,"technology":0,"medicine":0,"driving":0,"persuasion":0,"deception":2,"intimidation":0,"performance":0}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.shortbow","builtin.fantasy.lockpicks"]'::jsonb,
        '{"archetype":"rebel","essence":"physical","speciesTraitInstances":[{"trait":"natural-protection","source":"species-creation","acquiredAtLevel":1},{"trait":"natural-weapon","source":"species-creation","acquiredAtLevel":1}],"backgroundTemplateId":"smuggler","background":{"name":"Unterwelt & Grauzone","skillPool":["driving","deception","stealth","sleight"],"trainedSkills":["stealth","deception"],"backgroundSkillPoints":{"stealth":1,"deception":1},"specialization":{"skill":"stealth","name":"Urbane Tarnung","source":"background","acquiredAtLevel":1},"milieuAccess":"Randgebiete & Schleichwege","contact":"Schmugglerin an der Grenze","complication":"Teufelsauge — Markenzeichen und Gefahr","communication":"Handzeichen"},"archetypeTrainingSkill":"stealth","freeSkillRanks":{"stealth":1,"sleight":2,"acrobatics":2,"deception":1,"awareness":1},"specializations":[{"skill":"stealth","name":"Urbane Tarnung","source":"background","acquiredAtLevel":1}],"baseAttributes":{"strength":1,"dexterity":4,"endurance":3,"mind":2,"perception":3,"charisma":2},"nativeStarterSheetVersion":1,"drive":3,"momentum":0,"attributeAdvances":{}}'::jsonb
      ),
      (
        'pregen.mystic',
        'Liora Mondschein',
        'Mystikerin',
        'elf',
        2,
        '{"strength":1,"dexterity":2,"endurance":2,"mind":4,"perception":3,"charisma":3,"nativeAssetId":"pregen.mystic","nativeStarterSheetVersion":1}'::jsonb,
        '{"athletics":0,"acrobatics":0,"sleight":0,"stealth":0,"melee":0,"ranged":0,"awareness":2,"insight":1,"survival":0,"investigation":2,"knowledge":3,"technology":0,"medicine":0,"driving":0,"persuasion":2,"deception":0,"intimidation":0,"performance":0}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.quarterstaff","builtin.fantasy.healer-kit"]'::jsonb,
        '{"archetype":"thinker","essence":"spiritual","speciesTraitInstances":[{"trait":"enhanced-sight","source":"species-creation","acquiredAtLevel":1,"option":"darkvision"},{"trait":"low-rest-need","source":"species-creation","acquiredAtLevel":1}],"backgroundTemplateId":"academy-research","background":{"name":"Akademie & Forschung","skillPool":["knowledge","investigation","awareness","persuasion"],"trainedSkills":["knowledge"],"backgroundSkillPoints":{"knowledge":2},"specialization":{"skill":"knowledge","name":"Okkultes","source":"background","acquiredAtLevel":1},"milieuAccess":"Archive & Mondtempel","contact":"Mentorin der Akademie","complication":"Umstrittene Theorie","communication":"Akademischer Fachjargon"},"archetypeTrainingSkill":"knowledge","freeSkillRanks":{"investigation":2,"awareness":2,"persuasion":2,"insight":1},"specializations":[{"skill":"knowledge","name":"Okkultes","source":"background","acquiredAtLevel":1}],"baseAttributes":{"strength":1,"dexterity":2,"endurance":2,"mind":4,"perception":3,"charisma":3},"nativeStarterSheetVersion":1,"drive":3,"momentum":0,"attributeAdvances":{}}'::jsonb
      ),
      (
        'pregen.diplomat',
        'Oskar Federkiel',
        'Diplomat',
        'human',
        2,
        '{"strength":1,"dexterity":2,"endurance":2,"mind":3,"perception":3,"charisma":4,"nativeAssetId":"pregen.diplomat","nativeStarterSheetVersion":1}'::jsonb,
        '{"athletics":0,"acrobatics":0,"sleight":0,"stealth":0,"melee":0,"ranged":0,"awareness":2,"insight":3,"survival":0,"investigation":2,"knowledge":0,"technology":0,"medicine":0,"driving":0,"persuasion":2,"deception":1,"intimidation":0,"performance":0}'::jsonb,
        '["builtin.fantasy.healing-potion","builtin.fantasy.dagger","builtin.fantasy.writing-kit"]'::jsonb,
        '{"archetype":"diplomat","essence":"mental","speciesTraitInstances":[{"trait":"sharpened-sense","source":"species-creation","acquiredAtLevel":1,"option":"sense-sight"},{"trait":"narrow-resistance","source":"species-creation","acquiredAtLevel":1,"option":"poison-toxins"},{"trait":"enduring-organism","source":"species-creation","acquiredAtLevel":1}],"backgroundTemplateId":"investigator","background":{"name":"Ermittlung & Information","skillPool":["investigation","awareness","insight","persuasion"],"trainedSkills":["insight","investigation"],"backgroundSkillPoints":{"insight":1,"investigation":1},"specialization":{"skill":"insight","name":"Lügen erkennen","source":"background","acquiredAtLevel":1},"milieuAccess":"Höfe & Schreibstuben","contact":"Archivarin der Stadt","complication":"Offene Schuld gegenüber einem Gönner","communication":"Diplomatische Formeln"},"archetypeTrainingSkill":"insight","freeSkillRanks":{"insight":1,"persuasion":2,"awareness":2,"deception":1,"investigation":1},"specializations":[{"skill":"insight","name":"Lügen erkennen","source":"background","acquiredAtLevel":1}],"baseAttributes":{"strength":1,"dexterity":2,"endurance":2,"mind":3,"perception":3,"charisma":4},"nativeStarterSheetVersion":1,"drive":3,"momentum":0,"attributeAdvances":{}}'::jsonb
      )
) AS v(asset_id, char_name, class_label, race_key, lvl, attrs, skills, inv, profile)
WHERE c.attributes->>'nativeAssetId' = v.asset_id
  AND COALESCE(
    (c.attributes->>'nativeStarterSheetVersion')::int,
    (c.sagatree_profile->>'nativeStarterSheetVersion')::int,
    0
  ) < 1
  AND (
    c.sagatree_profile IS NULL
    OR NULLIF(BTRIM(COALESCE(c.sagatree_profile->>'archetype', '')), '') IS NULL
  );
