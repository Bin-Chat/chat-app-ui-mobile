export type ImageVariant = 'thumb' | 'medium' | 'large';

export function getVariantUrl(
  url: string | null | undefined,
  variant: ImageVariant
): string | undefined {
  if (!url) return undefined;
  if (/__thumb|__medium|__large/.test(url)) return url;
  const dotIdx = url.lastIndexOf('.');
  const base = dotIdx !== -1 ? url.slice(0, dotIdx) : url;
  return `${base}__${variant}.webp`;
}

export function getResponsiveImageUrl(
  url: string | null | undefined,
  containerWidth: number
): string | undefined {
  if (!url) return undefined;
  if (containerWidth <= 160) return getVariantUrl(url, 'thumb');
  if (containerWidth <= 600) return getVariantUrl(url, 'medium');
  return getVariantUrl(url, 'large');
}
