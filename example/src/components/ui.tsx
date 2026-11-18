import Link from 'next/link';
import { selectLabel, type ImageValue } from '@n3wtou/mnml-cms';
import config from '../../mnml.config';

/** The site's time zone, for showing stored (UTC) datetimes. */
export const SITE_TIME_ZONE = 'Europe/London';

/** A stored datetime as e.g. "18 November 2026 at 14:30" in the site's time zone. */
export const formatDateTime = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'long', timeStyle: 'short', timeZone: SITE_TIME_ZONE }).format(new Date(iso)) : null;

export const formatDate = (d: string | null) =>
  d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null;

/** A CMS image, or a soft gradient placeholder when there is none. */
export function Picture({ image, className = '' }: { image: ImageValue | null; className?: string }) {
  if (!image) return <div className={`bg-gradient-to-br from-[#efe3d3] to-[#e2c9b0] ${className}`} aria-hidden />;
  // oxlint-disable-next-line nextjs/no-img-element
  return <img src={image.url} alt={image.alt} className={`object-cover ${className}`} />;
}

/** A post's category, shown by its label from the config. */
export function Category({ children }: { children: string | null }) {
  const label = selectLabel(config.posts.fields.category, children);
  return label ? <span className="text-xs font-semibold uppercase tracking-widest text-accent">{label}</span> : null;
}

type PostItem = {
  slug: string;
  entry: { title: string; summary: string; date: string | null; category: string | null; cover: ImageValue | null; readingTime: number };
};

export function PostCard({ slug, entry, large = false }: PostItem & { large?: boolean }) {
  const meta = [formatDate(entry.date), entry.readingTime && `${entry.readingTime} min read`].filter(Boolean).join(' · ');
  return (
    <article className={`group relative flex gap-6 ${large ? 'flex-col md:flex-row md:items-center' : 'flex-col'}`}>
      <Picture image={entry.cover} className={`overflow-hidden rounded-xl ${large ? 'aspect-[16/10] md:w-1/2' : 'aspect-[16/10] w-full'}`} />
      <div className={`flex flex-col gap-2 ${large ? 'md:w-1/2' : ''}`}>
        <Category>{entry.category}</Category>
        <h3 className={`font-serif font-semibold leading-tight tracking-tight ${large ? 'text-3xl md:text-4xl' : 'text-xl'}`}>
          <Link href={`/posts/${slug}`} className="after:absolute after:inset-0 group-hover:text-accent">
            {entry.title}
          </Link>
        </h3>
        {entry.summary && <p className="text-soft">{entry.summary}</p>}
        {meta && <p className="text-sm text-mute">{meta}</p>}
      </div>
    </article>
  );
}
