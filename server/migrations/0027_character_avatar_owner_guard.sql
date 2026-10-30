-- MIG-302 follow-up (#801): cross-owner artifact FK guard as a new migration.
-- Must not amend 0026 — already-applied DBs would never receive in-place edits.

-- Cross-owner FK guard: artifact owner_user_id must match characters.owner_user_id.
CREATE TRIGGER IF NOT EXISTS character_avatar_artifacts_owner_guard_ins
BEFORE INSERT ON character_avatar_artifacts
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'foreign-character-owner')
  WHERE NOT EXISTS (
    SELECT 1 FROM characters c
    WHERE c.id = NEW.character_id
      AND c.owner_user_id = NEW.owner_user_id
      AND c.deleted_at IS NULL
  );
END;

CREATE TRIGGER IF NOT EXISTS character_avatar_artifacts_owner_guard_upd
BEFORE UPDATE OF character_id, owner_user_id ON character_avatar_artifacts
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'foreign-character-owner')
  WHERE NOT EXISTS (
    SELECT 1 FROM characters c
    WHERE c.id = NEW.character_id
      AND c.owner_user_id = NEW.owner_user_id
      AND c.deleted_at IS NULL
  );
END;
