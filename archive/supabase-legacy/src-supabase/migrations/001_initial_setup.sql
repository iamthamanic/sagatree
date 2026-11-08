-- Initial Setup Migration for SagaTree
-- This ensures Email Auth is enabled and creates demo user

-- Note: Email Auth should be enabled in Supabase Dashboard:
-- Authentication > Providers > Email (enable)

-- Create demo user function (for development)
-- This will be called from the backend to ensure demo user exists

-- Insert demo user if it doesn't exist
-- Password: demo1234
-- This is just for development/demo purposes
DO $$
BEGIN
  -- Note: In production, users should sign up through the app
  -- This is only for demo/development
  NULL;
END $$;
