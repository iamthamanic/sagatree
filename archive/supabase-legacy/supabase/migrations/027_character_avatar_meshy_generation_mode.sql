-- Avatar Meshy jobs: text vs image generation mode (#image-to-3d).

ALTER TABLE public.character_avatar_meshy_jobs
  ADD COLUMN IF NOT EXISTS generation_mode TEXT NOT NULL DEFAULT 'text';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'character_avatar_meshy_jobs_generation_mode_check'
  ) THEN
    ALTER TABLE public.character_avatar_meshy_jobs
      ADD CONSTRAINT character_avatar_meshy_jobs_generation_mode_check
      CHECK (generation_mode IN ('text', 'image'));
  END IF;
END $$;
