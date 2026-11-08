-- #682 — Account profile rows + peer-readable user avatar storage.
-- user_profiles: authenticated SELECT; own INSERT/UPDATE.
-- user-avatars: owner write under {auth.uid()}/…; authenticated SELECT for lobby peers.

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_profiles IS
  'Public account profile for lobby peers — not authorization; membership/RLS remain authoritative.';

CREATE OR REPLACE FUNCTION public.set_user_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_profiles_updated_at();

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_profiles_select_authenticated" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_own" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON public.user_profiles;

CREATE POLICY "user_profiles_select_authenticated"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "user_profiles_insert_own"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_name TEXT;
BEGIN
  meta_name := NULLIF(
    trim(
      coalesce(
        NEW.raw_user_meta_data ->> 'display_name',
        NEW.raw_user_meta_data ->> 'username',
        split_part(coalesce(NEW.email, ''), '@', 1)
      )
    ),
    ''
  );

  INSERT INTO public.user_profiles (id, display_name)
  VALUES (NEW.id, meta_name)
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Backfill existing auth users (local admin / seed / prior signups).
INSERT INTO public.user_profiles (id, display_name)
SELECT
  u.id,
  NULLIF(
    trim(
      coalesce(
        u.raw_user_meta_data ->> 'display_name',
        u.raw_user_meta_data ->> 'username',
        split_part(coalesce(u.email, ''), '@', 1)
      )
    ),
    ''
  )
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) VALUES (
  'user-avatars',
  'user-avatars',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can upload own user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can read user avatars" ON storage.objects;

CREATE POLICY "Users can upload own user avatars"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own user avatars"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own user avatars"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Peer-readable for session lobby (authenticated); path is not authorization.
CREATE POLICY "Authenticated can read user avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'user-avatars');
