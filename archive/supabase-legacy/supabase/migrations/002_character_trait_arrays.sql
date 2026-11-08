-- Character profile traits become composable blocks.
-- Existing non-empty scalar values are preserved as a single array element.
-- The ADD COLUMN guards keep this migration compatible with older SagaDrive schemas.

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS personality_traits TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ideals TEXT,
  ADD COLUMN IF NOT EXISTS bonds TEXT,
  ADD COLUMN IF NOT EXISTS flaws TEXT;

ALTER TABLE public.characters
  ALTER COLUMN personality_traits SET DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'characters'
      AND column_name = 'ideals'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.characters
      ALTER COLUMN ideals TYPE TEXT[]
      USING CASE
        WHEN ideals IS NULL OR btrim(ideals) = '' THEN ARRAY[]::TEXT[]
        ELSE ARRAY[ideals]
      END;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'characters'
      AND column_name = 'bonds'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.characters
      ALTER COLUMN bonds TYPE TEXT[]
      USING CASE
        WHEN bonds IS NULL OR btrim(bonds) = '' THEN ARRAY[]::TEXT[]
        ELSE ARRAY[bonds]
      END;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'characters'
      AND column_name = 'flaws'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.characters
      ALTER COLUMN flaws TYPE TEXT[]
      USING CASE
        WHEN flaws IS NULL OR btrim(flaws) = '' THEN ARRAY[]::TEXT[]
        ELSE ARRAY[flaws]
      END;
  END IF;
END $$;

ALTER TABLE public.characters
  ALTER COLUMN ideals SET DEFAULT '{}',
  ALTER COLUMN bonds SET DEFAULT '{}',
  ALTER COLUMN flaws SET DEFAULT '{}';
