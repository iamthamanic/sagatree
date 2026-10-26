/**
 * Quarantined legacy Edge `media` Map characterization (MIG-416 / #832).
 * Location: server/src/modules/media/internal/media-edge-quarantine.ts
 *
 * Constructs URLs without storing bytes. NOT durable host media ports.
 * NOT a public host route.
 */

export const MEDIA_EDGE_PUBLIC_ACTIVATION_AUTHORIZED = false as const;
/** Explicit: this Map is not the durable host media / storage adapter. */
export const MEDIA_EDGE_MAP_IS_DURABLE_STORAGE = false as const;

export type QuarantineMedia = {
  id: string;
  filename: string;
  type: string;
  size: number;
  url: string;
  projectId?: string;
  characterId?: string;
  tags: string[];
  uploadedBy: string;
  uploadedAt: string;
};

export type MediaEdgeStore = {
  readonly mediaFiles: Map<string, QuarantineMedia>;
  storageUrl: string;
};

export function createMediaEdgeStore(storageUrl = 'http://localhost:8000'): MediaEdgeStore {
  return { mediaFiles: new Map(), storageUrl };
}

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
  };
  return types[ext || ''] || 'application/octet-stream';
}

export function uploadMedia(
  store: MediaEdgeStore,
  data: {
    filename: string;
    content: string;
    projectId?: string;
    characterId?: string;
    tags?: string[];
    uploadedBy: string;
  },
  id: string,
  nowIso: string,
): QuarantineMedia {
  const type = getMimeType(data.filename);
  const url = `${store.storageUrl}/storage/v1/object/media/${id}-${data.filename}`;
  const size = Math.floor((data.content.length * 3) / 4);
  const media: QuarantineMedia = {
    id,
    filename: data.filename,
    type,
    size,
    url,
    projectId: data.projectId,
    characterId: data.characterId,
    tags: data.tags || [],
    uploadedBy: data.uploadedBy,
    uploadedAt: nowIso,
  };
  store.mediaFiles.set(id, media);
  return media;
}

export function getMedia(store: MediaEdgeStore, id: string): QuarantineMedia | null {
  return store.mediaFiles.get(id) || null;
}

export function listMedia(
  store: MediaEdgeStore,
  projectId?: string,
  type?: string,
): QuarantineMedia[] {
  let all = Array.from(store.mediaFiles.values());
  if (projectId) all = all.filter((m) => m.projectId === projectId);
  if (type) all = all.filter((m) => m.type.startsWith(type));
  return all;
}

export function deleteMedia(store: MediaEdgeStore, id: string): void {
  store.mediaFiles.delete(id);
}

export function updateMediaTags(
  store: MediaEdgeStore,
  id: string,
  tags: string[],
): QuarantineMedia {
  const media = store.mediaFiles.get(id);
  if (!media) throw new Error('Media not found');
  media.tags = tags;
  store.mediaFiles.set(id, media);
  return media;
}
