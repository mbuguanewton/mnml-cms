import type { RichTextNodeProps } from '@n3wtou/mnml-cms/editor';
import { youtubeId } from '../youtube';

/** Renders the rich-text `youtube` node as a privacy-friendly embed. */
export function YouTubeEmbed({ attrs }: RichTextNodeProps) {
  const id = youtubeId(attrs.url);
  const title = typeof attrs.title === 'string' && attrs.title ? attrs.title : 'YouTube video';
  if (!id) return null;
  return (
    <div className="video">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${id}`}
        title={title}
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
