-- 084: look_profiles public_id (LK-XXXXX)
-- Looks join the #276 public-id contract for Library corner menus.

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

ALTER TABLE public.look_profiles
  ADD COLUMN IF NOT EXISTS public_id TEXT;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.look_profiles WHERE public_id IS NULL LOOP
    UPDATE public.look_profiles
      SET public_id = public.generate_sagatree_public_id('LK')
      WHERE id = r.id;
  END LOOP;
END;
$$;

ALTER TABLE public.look_profiles
  ALTER COLUMN public_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS look_profiles_public_id_uidx
  ON public.look_profiles (public_id);

ALTER TABLE public.look_profiles
  DROP CONSTRAINT IF EXISTS look_profiles_public_id_format;
ALTER TABLE public.look_profiles
  ADD CONSTRAINT look_profiles_public_id_format
  CHECK (public_id ~ '^LK-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$');

DROP TRIGGER IF EXISTS trg_look_profiles_ensure_public_id ON public.look_profiles;
CREATE TRIGGER trg_look_profiles_ensure_public_id
  BEFORE INSERT ON public.look_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_public_id('LK');

DROP TRIGGER IF EXISTS trg_look_profiles_forbid_public_id_change ON public.look_profiles;
CREATE TRIGGER trg_look_profiles_forbid_public_id_change
  BEFORE UPDATE ON public.look_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.forbid_public_id_change();

COMMENT ON COLUMN public.look_profiles.public_id IS
  'Immutable public look id (LK-XXXXX). Not a secret; auth/RLS authorize access.';
