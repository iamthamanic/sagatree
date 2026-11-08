-- ============================================
-- RPC FUNCTIONS for SagaTree V3
-- These allow secure operations that bypass RLS
-- ============================================

-- Function: Find project by code (public access)
-- This allows users to find a project by its join code
CREATE OR REPLACE FUNCTION find_project_by_code(project_code TEXT)
RETURNS TABLE (
  id UUID,
  code TEXT,
  name TEXT,
  description TEXT,
  status TEXT,
  gm_user_id UUID,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with creator's permissions, bypassing RLS
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.code,
    p.name,
    p.description,
    p.status,
    p.gm_user_id,
    p.created_at
  FROM projects p
  WHERE p.code = UPPER(project_code)
  AND p.status IN ('active', 'paused');
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION find_project_by_code(TEXT) TO authenticated;

-- ============================================
-- SUCCESS
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ RPC Functions created successfully!';
  RAISE NOTICE 'You can now use: SELECT * FROM find_project_by_code(''ABC123'')';
END $$;
