-- MIG-501 follow-up (#938): record pending publish asset id so finalize/retry
-- after crash between publish and markFinalized stays single-asset idempotent.

ALTER TABLE asset_upload_sessions ADD COLUMN pending_asset_id TEXT;

-- pending_asset_id is cleared/ignored once finalized_asset_id is set.
