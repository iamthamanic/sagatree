-- 011: Deterministic seed for the local admin account (GoTrue user).
--
-- The admin login shortcut maps to a real auth.users row so every session
-- carries a valid UUID and a genuine JWT; RLS sees the authenticated role.
-- The row lives in the Docker DB (volume supabase-db-data) and is created
-- identically on every fresh deploy (local today, server later). The fixed
-- UUID doubles as the app offline fallback owner id
-- (src/lib/localAdmin.ts: LOCAL_ADMIN_USER_ID).
--
-- Canonical email: admin@sagatree.local (must match LOCAL_ADMIN_EMAIL).
-- Legacy admin@sagadrive.local is still recognized on re-apply / pre-080 volumes.
--
-- Idempotent: an existing admin row with a divergent id is normalized to
-- the seed uuid; a missing one is created. App rows owned by the divergent
-- id are reassigned first so no data loses its owner.

do $$
declare
  v_seed_id       uuid := '00000000-0000-4000-8000-000000000001';
  v_email         text := 'admin@sagatree.local';
  v_legacy_email  text := 'admin@sagadrive.local';
  v_password      text := '1234';
  v_existing      uuid;
begin
  select id into v_existing from auth.users where id = v_seed_id;
  if v_existing is null then
    select id into v_existing
    from auth.users
    where lower(email) in (lower(v_email), lower(v_legacy_email))
    limit 1;
  end if;

  if v_existing = v_seed_id then
    update auth.users set
      email              = v_email,
      encrypted_password = crypt(v_password, gen_salt('bf', 10)),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_app_meta_data  = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"username":"admin","display_name":"Admin"}'::jsonb,
      email_change       = '',
      updated_at         = now()
    where id = v_seed_id;
    raise notice '011: admin already seeded; email/password refreshed.';
  elsif v_existing is not null then
    -- Reassign app data (no-ops on a fresh DB), detach GoTrue dependents,
    -- then rename the auth row in place. Child rows first: the identities
    -- and sessions FKs resolve against the new id only after the update.
    update public.characters      set owner_user_id = v_seed_id where owner_user_id = v_existing;
    update public.projects        set gm_user_id    = v_seed_id where gm_user_id    = v_existing;
    update public.project_members set user_id       = v_seed_id where user_id       = v_existing;
    update public.session_players set user_id       = v_seed_id where user_id       = v_existing;
    update public.world_profiles  set owner_user_id = v_seed_id where owner_user_id = v_existing;
    update public.chat_messages   set user_id       = v_seed_id where user_id       = v_existing;
    update public.worlds          set creator_user_id = v_seed_id where creator_user_id = v_existing;
    update auth.mfa_factors       set user_id       = v_seed_id where user_id       = v_existing;
    update auth.refresh_tokens    set user_id       = v_seed_id::text where user_id = v_existing::text;

    delete from auth.identities where user_id = v_existing;
    delete from auth.sessions   where user_id = v_existing;

    update auth.users set
      id                 = v_seed_id,
      email              = v_email,
      encrypted_password = crypt(v_password, gen_salt('bf', 10)),
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      raw_app_meta_data  = '{"provider":"email","providers":["email"]}'::jsonb,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"username":"admin","display_name":"Admin"}'::jsonb,
      email_change       = '',
      updated_at         = now()
    where id = v_existing;
    raise notice '011: normalized admin user % -> %', v_existing, v_seed_id;
  else
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, last_sign_in_at,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change,
      email_change_confirm_status, is_sso_user
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_seed_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf', 10)),
      now(), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"username":"admin","display_name":"Admin"}'::jsonb,
      now(), now(),
      '', '', '', '',
      0, false
    );
    raise notice '011: created admin user %', v_seed_id;
  end if;

  if not exists (
    select 1 from auth.identities where user_id = v_seed_id and provider = 'email'
  ) then
    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_seed_id, 'email', v_email,
      jsonb_build_object('sub', v_seed_id::text, 'email', v_email),
      now(), now(), now()
    );
  else
    update auth.identities set
      provider_id = v_email,
      identity_data = coalesce(identity_data, '{}'::jsonb)
        || jsonb_build_object('sub', v_seed_id::text, 'email', v_email),
      updated_at = now()
    where user_id = v_seed_id and provider = 'email';
  end if;
end $$;
