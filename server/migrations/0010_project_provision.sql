-- RPC-SAGA-PROVISION (#873): project columns for saga version binding + adventure runtime.
-- projects remains owned by module `project`.

ALTER TABLE projects ADD COLUMN saga_version_id TEXT REFERENCES saga_definition_versions (id);
ALTER TABLE projects ADD COLUMN adventure_runtime TEXT NOT NULL DEFAULT '{}';
ALTER TABLE projects ADD COLUMN public_id TEXT;
ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE projects ADD COLUMN description TEXT;

CREATE INDEX IF NOT EXISTS projects_saga_version_id_idx ON projects (saga_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS projects_public_id_uidx ON projects (public_id) WHERE public_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_gm_saga_status_idx ON projects (gm_user_id, saga_id, status);
