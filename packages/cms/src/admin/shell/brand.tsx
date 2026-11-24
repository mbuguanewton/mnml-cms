'use client';

import { useState } from 'react';
import type { ResolvedLogo } from '../../server/admin/brand.js';

type Props = { name: string; logo: ResolvedLogo | null; size: 'nav' | 'login' };

/**
 * The admin's brand mark and name: the site's logo when it gave one, else the first letter of the name on a tile. A logo
 * image that fails to load falls back to the tile. Inline styles where the sign-in page needs them: it must look right
 * even before the host's Tailwind build knows the admin's newest classes.
 */
export function Brand({ name, logo, size }: Props) {
  const [broken, setBroken] = useState(false);
  const login = size === 'login';
  const px = login ? 48 : 28;
  const image = logo && 'src' in logo && !broken ? logo : null;
  const wordmark = image?.wordmark === true;

  const tile = (
    <span
      className="font-mnml-brand"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        width: px,
        height: px,
        borderRadius: login ? 12 : 6,
        fontSize: login ? 24 : 18,
        fontWeight: 700,
        background: 'var(--mnml-primary)',
        color: 'var(--mnml-on-primary)',
        boxShadow: login ? '0 1px 2px rgb(0 0 0 / 0.12)' : undefined,
      }}
    >
      {name[0] ?? 'A'}
    </span>
  );

  const img = (src: string, alt: string, className: string) => (
    // Plain <img>: a logo can be any URL, no need for next/image here.
    // oxlint-disable-next-line nextjs/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setBroken(true)}
      // The image can fail before React hydrates, when onError no longer fires: check once it is mounted.
      ref={(el) => {
        if (el?.complete && el.naturalWidth === 0) setBroken(true);
      }}
      style={{ display: 'block', height: px, width: 'auto', maxWidth: login ? 240 : wordmark ? 208 : 112, objectFit: 'contain' }}
    />
  );

  let mark = tile;
  if (logo && 'node' in logo) mark = <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, height: px }}>{logo.node}</span>;
  else if (image)
    mark = (
      <>
        {img(image.src, image.alt, image.dark ? 'mnml-logo-light' : '')}
        {image.dark && img(image.dark, image.alt, 'mnml-logo-dark')}
      </>
    );

  return (
    <>
      {mark}
      {!wordmark && (
        <span className={login ? 'font-mnml-brand' : 'truncate font-semibold'} style={login ? { fontSize: 18, fontWeight: 600 } : undefined}>
          {name}
        </span>
      )}
    </>
  );
}
