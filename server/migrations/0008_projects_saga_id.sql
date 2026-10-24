-- RPC-SAGA-VERSION-READ (#872): link projects to saga definitions for membership/GM reads.
-- projects remains owned by module `project`; saga_id is a nullable FK to saga_definitions.

ALTER TABLE projects ADD COLUMN saga_id TEXT REFERENCES saga_definitions (id);

CREATE INDEX IF NOT EXISTS projects_saga_id_idx ON projects (saga_id);
