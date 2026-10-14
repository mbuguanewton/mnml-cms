---
'@n3wtou/mnml-cms': major
---

Everything named `cms-*` is now `mnml-*`.

- CSS variables `--cms-*` → `--mnml-*` (e.g. `--mnml-primary`, `--mnml-font-brand`), classes `cms-prose` / `cms-root` / `cms-state` → `mnml-*`, and the Tailwind tokens `bg-cms-*` / `text-cms-*` / `font-cms-brand` → `bg-mnml-*` / `text-mnml-*` / `font-mnml-brand`. Rename any overrides in your CSS.
- The default `apiPath` is `/api/mnml` (was `/api/cms`): move `app/api/cms/[...route]/route.ts` to `app/api/mnml/[...route]/route.ts`. Images saved before are stored as `/api/cms/media/…` URLs, so existing sites should keep `apiPath: '/api/cms'` (or rewrite those URLs in the entries) — otherwise those images 404 and the Media screen lists them as unused.
- `localMedia()` stores files in `.mnml-uploads` (was `.cms-uploads`): rename the folder and its `.gitignore` entry.
- Cookies are `mnml_session` and `mnml_preview`, so editors sign in again once after upgrading.
- Docs and the example use `mnml.config.ts`, `src/mnml.ts` and `src/mnml-editor.ts` (file names are your choice; nothing in the package depends on them).
