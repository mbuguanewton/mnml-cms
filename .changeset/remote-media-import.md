---
'@n3wtou/mnml-cms': minor
---

New `mediaImporter(storage)` and `importRemoteMedia(url, storage)` in `@n3wtou/mnml-cms/sync`: copy images from another site (e.g. `cdn.sanity.io`) into the site's media storage for migration scripts, returning the URL for an `image` field. Idempotent: each source URL is stored once and found again on later runs through the storage's `list()`. Only https JPEG/PNG/WebP/GIF/AVIF images up to 4 MB by default (`maxBytes`).
