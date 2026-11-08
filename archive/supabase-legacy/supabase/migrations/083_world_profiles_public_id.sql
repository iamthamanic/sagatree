-- 083: world_profiles public_id (WO-XXXXX)
-- Worlds join the #276 public-id contract so Library can copy world IDs.

-- ensure_public_id may still reference the dropped sagadrive generator alias — pin to sagatree.
CREATE OR REPLACE FUNCTION public.ensure_public_id()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  prefix TEXT;
BEGIN
  IF NEW.public_id IS NOT NULL AND btrim(NEW.public_id) <> '' THEN
    NEW.public_id := upper(btrim(NEW.public_id));
    RETURN NEW;
  END IF;

  prefix := TG_ARGV[0];
  NEW.public_id := public.generate_sagatree_public_id(prefix);
  RETURN NEW;
END;
$$;

ALTER TABLE public.world_profiles
  ADD COLUMN IF NOT EXISTS public_id TEXT;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.world_profiles WHERE public_id IS NULL LOOP
    UPDATE public.world_profiles
      SET public_id = public.generate_sagatree_public_id('WO')
      WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.world_profiles
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS world_profiles_public_id_uidx
  ON public.world_profiles (public_id);

ALTER TABLE public.world_profiles
  DROP CONSTRAINT IF EXISTS world_profiles_public_id_format;
ALTER TABLE public.world_profiles
  ADD CONSTRAINT world_profiles_public_id_format
  CHECK (public_id ~ '^WO-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$');

DROP TRIGGER IF EXISTS trg_world_profiles_ensure_public_id ON public.world_profiles;
CREATE TRIGGER trg_world_profiles_ensure_public_id
  BEFORE INSERT ON public.world_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_public_id('WO');

DROP TRIGGER IF EXISTS trg_world_profiles_forbid_public_id_change ON public.world_profiles;
CREATE TRIGGER trg_world_profiles_forbid_public_id_change
  BEFORE UPDATE ON public.world_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.forbid_public_id_change();

COMMENT ON COLUMN public.world_profiles.public_id IS
  'Immutable public world id (WO-XXXXX). Not a secret; auth/RLS authorize access.';
