/**
 * useItemThumbnailSrc — resolve thumbnail2d assetKey to a signed URL (#140).
 * App-slice hook; infrastructure service only, no direct backend client.
 * Location: src/app/items/useItemThumbnailSrc.ts
 */
import { useEffect, useState } from 'react';
import { parseItemThumbnailAssetKey } from '../../domains/items';
import { itemThumbnailService } from '../../infrastructure/inventory/item-thumbnail-service';

export function useItemThumbnailSrc(assetKey: string | undefined | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!parseItemThumbnailAssetKey(assetKey)) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    void itemThumbnailService.resolveSignedUrl(assetKey as string).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [assetKey]);

  return url;
}
