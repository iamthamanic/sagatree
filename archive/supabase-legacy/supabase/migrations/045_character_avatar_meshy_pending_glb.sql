-- 045_character_avatar_meshy_pending_glb.sql
-- Persist Meshy Auto-Rig GLB URL across polls so download+upload run alone
-- (avoids Edge CPU hard-limit kills when remesh/rig success shares a turn with materialize).

ALTER TABLE public.character_avatar_meshy_jobs
  ADD COLUMN IF NOT EXISTS pending_glb_url TEXT;

COMMENT ON COLUMN public.character_avatar_meshy_jobs.pending_glb_url IS
  'Temporary Meshy CDN GLB URL after Auto-Rig SUCCEEDED; cleared after storage upload.';
