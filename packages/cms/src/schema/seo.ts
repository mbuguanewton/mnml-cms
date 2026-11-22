import type { Metadata } from 'next';
import type { EntryOf, ImageValue, SeoField } from './define.js';

type SeoValue = EntryOf<SeoField['fields']>;

/**
 * Next.js `Metadata` from a `fields.seo()` value. Empty values fall back to `fallback`,
 * e.g. the entry's own title:
 *
 *   export const generateMetadata = async () => seoMetadata(page.seo, { title: page.title });
 */
export function seoMetadata(
  seo: Partial<SeoValue> | null | undefined,
  fallback: { title?: string; description?: string; image?: ImageValue | null } = {},
): Metadata {
  const title = seo?.title || fallback.title;
  const description = seo?.description || fallback.description;
  const image = seo?.image ?? fallback.image;
  const openGraph: NonNullable<Metadata['openGraph']> = {
    ...(title && { title }),
    ...(description && { description }),
    ...(image && { images: [{ url: image.url, alt: image.alt }] }),
  };
  return {
    ...(title && { title }),
    ...(description && { description }),
    ...(Object.keys(openGraph).length > 0 && { openGraph }),
  };
}
