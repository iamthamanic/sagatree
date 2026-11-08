-- 030_character_avatar_meshy_rig_task.sql
-- Persist Meshy Auto-Rig task id across polls (idempotent create).

ALTER TABLE public.character_avatar_meshy_jobs
  ADD COLUMN IF NOT EXISTS rig_task_id TEXT;

COMMENT ON COLUMN public.character_avatar_meshy_jobs.rig_task_id IS
  'Meshy OpenAPI v1 /rigging task id; set once while status=rigging';
