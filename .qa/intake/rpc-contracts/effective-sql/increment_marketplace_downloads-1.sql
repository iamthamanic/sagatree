-- Derived source contract only; DO NOT deploy this catalogue.
CREATE OR REPLACE FUNCTION increment_marketplace_downloads(item_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE marketplace_items
  SET downloads = downloads + 1
  WHERE id = item_id;
END;
$$;
