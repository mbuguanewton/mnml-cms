import { isValidElement, type ReactElement } from 'react';

/** A logo for the brand section: an image URL, an image with a dark-theme variant, or your own element. */
export type BrandLogo =
  | string
  | ReactElement
  | {
      src: string;
      /** Shown instead of `src` in the admin's dark theme. */
      dark?: string;
      /** Defaults to empty when the name is shown beside the logo, and to the name with `wordmark`. */
      alt?: string;
      /** The image already contains the name: hide the text and size the image by its height. */
      wordmark?: boolean;
    };
/** The `brand` option: just a name, or a name with a logo. */
export type BrandOption = string | { name: string; logo?: BrandLogo };

export type ResolvedLogo = { src: string; dark?: string; alt: string; wordmark: boolean } | { node: ReactElement };
export type ResolvedBrand = { name: string; logo: ResolvedLogo | null };

const DEFAULT_NAME = 'Admin';

/** The brand option in one shape, whichever form the site used. */
export function resolveBrand(option: BrandOption | undefined): ResolvedBrand {
  if (option === undefined) return { name: DEFAULT_NAME, logo: null };
  if (typeof option === 'string') return { name: option || DEFAULT_NAME, logo: null };
  const name = option.name || DEFAULT_NAME;
  const logo = option.logo;
  if (!logo) return { name, logo: null };
  if (typeof logo === 'string') return { name, logo: { src: logo, alt: '', wordmark: false } };
  if (isValidElement(logo)) return { name, logo: { node: logo } };
  const wordmark = logo.wordmark === true;
  return { name, logo: { src: logo.src, dark: logo.dark, alt: logo.alt ?? (wordmark ? name : ''), wordmark } };
}
