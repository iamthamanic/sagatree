-- #dornhain-starter — Idempotent Dornhain native seed + character SELECT RLS
-- that does not depend on authenticated table SELECT on projects.
--
-- 063 seed fails under trg_forbid_native_saga_insert when auth.role() is not
-- service_role (plain postgres migration apply). Disable the trigger only for
-- the seed block. Character RLS previously used `FROM projects` which can
-- 42501 under column-level SELECT allow-lists; use is_project_gm instead.

-- ---------------------------------------------------------------------------
-- Dornhain native definition + published v1 (idempotent)
-- ---------------------------------------------------------------------------
ALTER TABLE public.saga_definitions DISABLE TRIGGER trg_forbid_native_saga_insert;

DO $$
DECLARE
  v_saga_id UUID := 'a5740000-0000-4000-8000-00000000d001';
  v_ver_id UUID := 'a5740000-0000-4000-8000-00000000d002';
  v_payload JSONB;
BEGIN
  v_payload := jsonb_build_object(
    'packageId', 'package:dornhain.whisper.v1',
    'schemaVersion', 1,
    'title', 'Das Flüstern unter Dornhain',
    'synopsis', 'Fantasy-Mystery-Sandbox (60–90 Min): Verschwinden, falsche Banditen-Schuld, geöffnetes Relikt, verborgene Beteiligung und eskalierende Gefahr — freie Reihenfolge der Orte.',
    'locations', jsonb_build_array(
      jsonb_build_object('id', 'loc.tavern', 'label', 'Taverne Zum Flüstern'),
      jsonb_build_object('id', 'loc.market', 'label', 'Marktplatz Dornhain'),
      jsonb_build_object('id', 'loc.woods', 'label', 'Schattenwald'),
      jsonb_build_object('id', 'loc.crypt', 'label', 'Krypta unter dem Hügel'),
      jsonb_build_object('id', 'loc.bandit-camp', 'label', 'Banditenlager (falsche Spur)')
    ),
    'knowledgeFacts', jsonb_build_array(
      jsonb_build_object('id', 'fact.disappearances', 'visibility', 'public', 'summary', 'In Dornhain verschwinden Menschen — die Stadt ist nervös.'),
      jsonb_build_object('id', 'fact.bandits-suspected', 'visibility', 'discovered', 'summary', 'Viele verdächtigen Banditen — sie sind nicht die eigentliche Ursache.'),
      jsonb_build_object('id', 'fact.relic-opened', 'visibility', 'gm_only', 'summary', 'Ein Relikt wurde geöffnet; die Gefahr eskaliert mit der Zeit.'),
      jsonb_build_object('id', 'fact.hidden-npc', 'visibility', 'gm_only', 'summary', 'Ein vertrauter Dorfbewohner ist in die Reliktöffnung verwickelt.')
    ),
    'escalationClocks', jsonb_build_array(
      jsonb_build_object('id', 'danger', 'label', 'Reliktgefahr', 'max', 6),
      jsonb_build_object('id', 'suspicion', 'label', 'Dorfverdacht', 'max', 4)
    )
  );

  INSERT INTO public.saga_definitions (id, slug, title, synopsis, origin, owner_user_id)
  VALUES (
    v_saga_id,
    'dornhain.whisper',
    'Das Flüstern unter Dornhain',
    'Fantasy-Mystery-Sandbox (60–90 Min).',
    'native',
    NULL
  )
  ON CONFLICT (slug) DO UPDATE
    SET title = EXCLUDED.title,
        synopsis = EXCLUDED.synopsis,
        updated_at = NOW();

  INSERT INTO public.saga_definition_versions (
    id, saga_id, version_label, status, payload, published_at
  ) VALUES (
    v_ver_id, v_saga_id, 'v1', 'published', v_payload, NOW()
  )
  ON CONFLICT (saga_id, version_label) DO UPDATE
    SET payload = EXCLUDED.payload,
        status = 'published',
        published_at = COALESCE(public.saga_definition_versions.published_at, NOW());
END;
$$;

ALTER TABLE public.saga_definitions ENABLE TRIGGER trg_forbid_native_saga_insert;

-- ---------------------------------------------------------------------------
-- Character SELECT: owner / public / GM via SECURITY DEFINER / active member
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their characters" ON public.characters;

CREATE POLICY "Users can view their characters" ON public.characters
  FOR SELECT
  USING (
    owner_user_id = auth.uid()
    OR is_public = true
    OR (
      project_id IS NOT NULL
      AND (
        public.is_project_gm(project_id, auth.uid())
        OR public.current_user_is_active_project_member(project_id)
      )
    )
  );
