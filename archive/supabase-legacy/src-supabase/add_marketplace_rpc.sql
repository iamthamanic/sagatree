-- ============================================
-- Marketplace RPC Functions
-- Optional: Deploy these functions for better performance
-- ============================================

-- Function to increment downloads count atomically
CREATE OR REPLACE FUNCTION increment_marketplace_downloads(item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE marketplace_items
  SET downloads = downloads + 1
  WHERE id = item_id;
END;
$$;

-- Function to update rating (for future implementation)
CREATE OR REPLACE FUNCTION update_marketplace_rating(item_id UUID, new_rating DECIMAL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE marketplace_items
  SET rating = new_rating,
      updated_at = now()
  WHERE id = item_id;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION increment_marketplace_downloads(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_marketplace_rating(UUID, DECIMAL) TO authenticated;
