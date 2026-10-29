-- ============================================
-- MARKETPLACE TABLE - Quick Deploy
-- ============================================
-- Run this in your Supabase SQL Editor to create the marketplace_items table

-- Create marketplace_items table
CREATE TABLE IF NOT EXISTS marketplace_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('world', 'adventure', 'character', 'item', 'ruleset')),
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  rating DECIMAL(3,2) NOT NULL DEFAULT 0.00 CHECK (rating >= 0 AND rating <= 5),
  downloads INTEGER NOT NULL DEFAULT 0,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (price >= 0),
  image_url TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_marketplace_type ON marketplace_items(type);
CREATE INDEX IF NOT EXISTS idx_marketplace_author ON marketplace_items(author_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_downloads ON marketplace_items(downloads DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_rating ON marketplace_items(rating DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_featured ON marketplace_items(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_marketplace_tags ON marketplace_items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_marketplace_created ON marketplace_items(created_at DESC);

-- Enable Row Level Security
ALTER TABLE marketplace_items ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read marketplace items
CREATE POLICY "Marketplace items are viewable by everyone"
  ON marketplace_items
  FOR SELECT
  USING (true);

-- Policy: Authenticated users can create items
CREATE POLICY "Authenticated users can create marketplace items"
  ON marketplace_items
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Policy: Authors can update their own items
CREATE POLICY "Authors can update their own marketplace items"
  ON marketplace_items
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Policy: Authors can delete their own items
CREATE POLICY "Authors can delete their own marketplace items"
  ON marketplace_items
  FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_marketplace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER marketplace_updated_at
  BEFORE UPDATE ON marketplace_items
  FOR EACH ROW
  EXECUTE FUNCTION update_marketplace_updated_at();

-- Client-trust (#675): privileged columns are server-authority only
CREATE OR REPLACE FUNCTION public.marketplace_items_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;
    NEW.author_id := auth.uid();
    NEW.rating := 0;
    NEW.downloads := 0;
    NEW.is_featured := false;
    NEW.created_at := now();
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    NEW.author_id := OLD.author_id;
    NEW.rating := OLD.rating;
    NEW.downloads := OLD.downloads;
    NEW.is_featured := OLD.is_featured;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS marketplace_items_guard_privileged_columns ON public.marketplace_items;
CREATE TRIGGER marketplace_items_guard_privileged_columns
  BEFORE INSERT OR UPDATE ON public.marketplace_items
  FOR EACH ROW
  EXECUTE FUNCTION public.marketplace_items_guard_privileged_columns();

REVOKE ALL ON TABLE public.marketplace_items FROM PUBLIC;
REVOKE INSERT, UPDATE ON TABLE public.marketplace_items FROM anon;
REVOKE INSERT, UPDATE ON TABLE public.marketplace_items FROM authenticated;
GRANT SELECT ON TABLE public.marketplace_items TO anon, authenticated;
-- Include author_id/rating/downloads so PostgREST INSERT privilege checks pass;
-- the BEFORE INSERT guard still overwrites them from auth.uid()/zeros.
GRANT INSERT (
  type,
  title,
  description,
  author_id,
  data,
  rating,
  downloads,
  price,
  image_url,
  tags
) ON TABLE public.marketplace_items TO authenticated;
GRANT UPDATE (
  type,
  title,
  description,
  data,
  price,
  image_url,
  tags,
  updated_at
) ON TABLE public.marketplace_items TO authenticated;
GRANT DELETE ON TABLE public.marketplace_items TO authenticated;

-- RPC Function: Increment downloads atomically (DEFINER bypasses client column grants)
CREATE OR REPLACE FUNCTION increment_marketplace_downloads(item_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE marketplace_items
  SET downloads = downloads + 1
  WHERE id = item_id;
END;
$$;

REVOKE ALL ON FUNCTION increment_marketplace_downloads(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_marketplace_downloads(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION increment_marketplace_downloads(UUID) TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Marketplace table created successfully!';
  RAISE NOTICE '📝 You can now create marketplace items via the Marktplatz (Marketplace) view';
END $$;
