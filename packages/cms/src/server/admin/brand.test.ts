import { createElement } from 'react';
import { describe, expect, it } from 'vite-plus/test';
import { resolveBrand } from './brand.js';

describe('resolveBrand', () => {
  it('keeps a plain name working, with a default', () => {
    expect(resolveBrand('Example')).toEqual({ name: 'Example', logo: null });
    expect(resolveBrand(undefined)).toEqual({ name: 'Admin', logo: null });
    expect(resolveBrand('')).toEqual({ name: 'Admin', logo: null });
  });

  it('takes a name without a logo', () => {
    expect(resolveBrand({ name: 'Example' })).toEqual({ name: 'Example', logo: null });
  });

  it('turns a logo URL into an image with the name shown beside it', () => {
    expect(resolveBrand({ name: 'Example', logo: '/logo.svg' }).logo).toEqual({ src: '/logo.svg', alt: '', wordmark: false });
  });

  it('keeps the dark variant and an explicit alt', () => {
    expect(resolveBrand({ name: 'Example', logo: { src: '/l.svg', dark: '/d.svg', alt: 'Example logo' } }).logo).toEqual({
      src: '/l.svg',
      dark: '/d.svg',
      alt: 'Example logo',
      wordmark: false,
    });
  });

  it('names a wordmark image after the site, since no text sits beside it', () => {
    expect(resolveBrand({ name: 'Example', logo: { src: '/w.svg', wordmark: true } }).logo).toMatchObject({ alt: 'Example', wordmark: true });
  });

  it('passes an element through', () => {
    const el = createElement('svg');
    expect(resolveBrand({ name: 'Example', logo: el }).logo).toEqual({ node: el });
  });
});
