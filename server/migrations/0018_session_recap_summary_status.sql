-- RPC-SESSION-RECAP (#870): summary_status for draft/approved/none projection.
ALTER TABLE session_recaps ADD COLUMN summary_status TEXT NOT NULL DEFAULT 'none';

UPDATE session_recaps
SET summary_status = 'none'
WHERE summary_status IS NULL OR TRIM(summary_status) = '';
