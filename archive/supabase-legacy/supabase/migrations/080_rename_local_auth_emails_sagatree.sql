-- 080: Rename seeded local GoTrue emails sagadrive.local → sagatree.local.
--
-- App shortcuts (src/lib/localAdmin.ts / localPlayer.ts) already use
-- @sagatree.local. Historical 011/074 seeded @sagadrive.local, so Local Admin
-- GoTrue login failed and fell back to an offline UI user without JWT → PostgREST
-- as anon → 42501 permission denied across the library.
--
-- Idempotent: only updates rows still on the legacy emails (or identities).

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT *
    FROM (VALUES
      (
        '00000000-0000-4000-8000-000000000001'::uuid,
        'admin@sagadrive.local',
        'admin@sagatree.local'
      ),
      (
        '00000000-0000-4000-8000-000000000002'::uuid,
        'player@sagadrive.local',
        'player@sagatree.local'
      )
    ) AS t(seed_id, legacy_email, new_email)
  LOOP
    -- Prefer fixed seed id; also catch legacy email if id drifted.
    UPDATE auth.users u
    SET
      email = r.new_email,
      email_change = '',
      updated_at = now()
    WHERE (
        u.id = r.seed_id
        OR lower(u.email) = lower(r.legacy_email)
      )
      AND lower(u.email) IS DISTINCT FROM lower(r.new_email);

    UPDATE auth.identities i
    SET
      provider_id = r.new_email,
      identity_data = coalesce(i.identity_data, '{}'::jsonb)
        || jsonb_build_object('email', r.new_email, 'sub', coalesce(i.user_id::text, r.seed_id::text)),
      updated_at = now()
    WHERE i.provider = 'email'
      AND i.user_id IN (
        SELECT u.id
        FROM auth.users u
        WHERE u.id = r.seed_id
           OR lower(u.email) = lower(r.new_email)
           OR lower(u.email) = lower(r.legacy_email)
      )
      AND (
        lower(i.provider_id) = lower(r.legacy_email)
        OR lower(coalesce(i.identity_data ->> 'email', '')) = lower(r.legacy_email)
        OR lower(i.provider_id) IS DISTINCT FROM lower(r.new_email)
      );

    RAISE NOTICE '080: ensured local auth email % (seed %)', r.new_email, r.seed_id;
  END LOOP;
END $$;
