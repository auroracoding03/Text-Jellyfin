export function documentCoverSrc(document: {
  id: string;
  updatedAt: string;
  sidecarHash?: string | null;
}): string {
  const token = document.sidecarHash?.slice(0, 12) || document.updatedAt;
  return `/api/works/${document.id}/cover?v=${encodeURIComponent(token)}`;
}
