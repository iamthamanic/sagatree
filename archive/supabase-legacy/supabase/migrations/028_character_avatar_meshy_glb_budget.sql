-- Avatar Meshy: larger storage budget + remesh task tracking for oversized GLBs.

ALTER TABLE public.character_avatar_meshy_jobs
  ADD COLUMN IF NOT EXISTS remesh_task_id TEXT;

UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'character-avatars';
