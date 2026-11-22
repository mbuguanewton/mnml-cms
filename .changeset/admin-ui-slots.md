---
'@n3wtou/mnml-cms': minor
---

New `ui` option: use your own components (e.g. shadcn) for the admin's Button, Input, Textarea, Select, Checkbox, Switch, Tooltip and Menu. Build it with `uiProvider(slots)` from `@n3wtou/mnml-cms/admin`; slots you leave out keep the built-in ones. On admin pages a token bridge points shadcn's variables (`--primary`, `--border`, `--popover`…) at the admin's `--mnml-*` tokens, so your components match the admin while the rest of your site keeps its theme. `useAdminPortal()` gives popovers a portal target inside the admin's modal dialogs. New `mnml-admin` class on the admin's root. Not breaking. See [Custom admin UI](https://mnml-cms.vercel.app/custom-admin-ui).
