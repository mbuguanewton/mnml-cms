import 'server-only';
import { draftMode, headers } from 'next/headers';
import { EyeIcon } from 'lucide-react';

/**
 * Shown on the public site while an editor is previewing. Render it in the site layout.
 * Hidden inside the editor's live-preview frame, where Exit would stop the preview.
 * headers() is only read in Draft Mode, so static pages stay static.
 */
export function createPreviewBanner(apiPath: string) {
  return async function PreviewBanner() {
    if (!(await draftMode()).isEnabled) return null;
    if ((await headers()).get('sec-fetch-dest') === 'iframe') return null;
    return (
      <div className="cms-root sticky top-0 z-50 flex items-center justify-center gap-3 bg-cms-warn px-4 py-2 text-sm text-cms-on-warn [font-family:ui-sans-serif,system-ui,sans-serif]">
        <EyeIcon className="size-4" />
        <span>Preview: unsaved changes are shown. Visitors see the saved version.</span>
        <form action={`${apiPath}/preview/exit`} method="post">
          <button type="submit" className="cursor-pointer rounded-[6px] bg-cms-bg/70 px-2.5 py-1 font-medium hover:bg-cms-bg">
            Exit preview
          </button>
        </form>
      </div>
    );
  };
}
