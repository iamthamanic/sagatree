-- LookProfile persistence (#340): owner-scoped profiles + append-only versions.
-- Domain contracts: src/domains/look/**. No ToonLab/provider blobs as truth.

-- ---------------------------------------------------------------------------
-- 1. Profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.look_profiles (
  id TEXT PRIMARY KEY CHECK (char_length(btrim(id)) BETWEEN 8 AND 160),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_scope TEXT NOT NULL DEFAULT 'player-character'
    CHECK (owner_scope IN ('system', 'saga', 'session', 'player-character')),
  current_version INTEGER NOT NULL DEFAULT 1 CHECK (current_version >= 1),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_look_profiles_owner_status
  ON public.look_profiles(owner_user_id, status);

CREATE INDEX IF NOT EXISTS idx_look_profiles_updated
  ON public.look_profiles(updated_at DESC);

COMMENT ON TABLE public.look_profiles IS
  'SagaDrive LookProfile identities (owner-scoped). Versions live in look_profile_versions.';

ALTER TABLE public.look_profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.look_profiles FROM PUBLIC;
REVOKE ALL ON TABLE public.look_profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON TABLE public.look_profiles TO authenticated;
GRANT ALL ON TABLE public.look_profiles TO service_role;

CREATE POLICY "Read own look profiles"
  ON public.look_profiles
  FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Insert own look profiles"
  ON public.look_profiles
  FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Update own look profiles"
  ON public.look_profiles
  FOR UPDATE
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- No DELETE policy: archive only.

CREATE OR REPLACE FUNCTION public.set_look_profiles_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_look_profiles_updated_at ON public.look_profiles;
CREATE TRIGGER trg_look_profiles_updated_at
  BEFORE UPDATE ON public.look_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_look_profiles_updated_at();

CREATE OR REPLACE FUNCTION public.prevent_look_profile_retarget()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'look_profiles.id is immutable';
  END IF;
  IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
    RAISE EXCEPTION 'look_profiles.owner_user_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_look_profiles_no_retarget ON public.look_profiles;
CREATE TRIGGER trg_look_profiles_no_retarget
  BEFORE UPDATE ON public.look_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_look_profile_retarget();

-- ---------------------------------------------------------------------------
-- 2. Versions (append-only)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.look_profile_versions (
  profile_id TEXT NOT NULL REFERENCES public.look_profiles(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version >= 1),
  source TEXT NOT NULL CHECK (source IN ('manual', 'preset', 'reference-analysis', 'imported')),
  display_name TEXT NOT NULL CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 200),
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  execution_modes JSONB NOT NULL,
  look_references JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, version),
  CHECK (jsonb_typeof(capabilities) = 'array'),
  CHECK (jsonb_typeof(execution_modes) = 'array'),
  CHECK (jsonb_typeof(look_references) = 'array'),
  CHECK (jsonb_array_length(execution_modes) >= 1)
);

CREATE INDEX IF NOT EXISTS idx_look_profile_versions_profile
  ON public.look_profile_versions(profile_id, version DESC);

COMMENT ON TABLE public.look_profile_versions IS
  'Immutable LookProfile versions. Edits/re-analysis append a new row; never UPDATE payload.';

COMMENT ON COLUMN public.look_profile_versions.look_references IS
  'LookReference[] with kind style|content, uri asset ref, optional weight 0..1.';

ALTER TABLE public.look_profile_versions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.look_profile_versions FROM PUBLIC;
REVOKE ALL ON TABLE public.look_profile_versions FROM anon;
GRANT SELECT, INSERT ON TABLE public.look_profile_versions TO authenticated;
GRANT ALL ON TABLE public.look_profile_versions TO service_role;

-- Read versions only for profiles the user owns.
CREATE POLICY "Read own look profile versions"
  ON public.look_profile_versions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.look_profiles p
      WHERE p.id = look_profile_versions.profile_id
        AND p.owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Insert versions for own look profiles"
  ON public.look_profile_versions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.look_profiles p
      WHERE p.id = look_profile_versions.profile_id
        AND p.owner_user_id = auth.uid()
    )
  );

-- Deliberately no UPDATE/DELETE on versions: append-only history.
