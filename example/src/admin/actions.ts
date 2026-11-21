'use server';

import { revalidatePath } from 'next/cache';
import { cms } from '../mnml';

const paths = { site: '/', posts: '/posts', authors: '/authors' } as const;

/** Clears Next's cache for part of the site. Editors only. */
export async function refreshCache(section: keyof typeof paths, withHome: boolean) {
  if (!(await cms.isAdmin())) return { ok: false, message: 'Sign in again.' };
  const path = paths[section];
  if (!path) return { ok: false, message: 'Unknown section.' };
  revalidatePath(path, 'layout');
  if (withHome && path !== '/') revalidatePath('/');
  return { ok: true, message: section === 'site' ? 'Whole site refreshed' : `${path} refreshed${withHome ? ', and the home page' : ''}` };
}
