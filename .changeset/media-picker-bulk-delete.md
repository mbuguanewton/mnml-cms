---
'@n3wtou/mnml-cms': minor
---

Reuse uploads, and delete many at once. With a media storage that can `list`, an `image` field gets "Choose from uploads" and the rich text Image tool opens the same picker: stored files newest first, search by name, and "Upload new" inside it. The Media page gets a Select mode (checkbox per file, Select all, Select unused, Clear, Delete) with one confirmation that warns about files still used in entries; files that fail are reported and the rest are deleted. New admin route `media/list`, and `media/delete` also takes `keys` (up to 100). Not breaking; `media/delete` with a single `key` works as before. Fix: closing a dialog opened from the fullscreen editor no longer leaves fullscreen.
