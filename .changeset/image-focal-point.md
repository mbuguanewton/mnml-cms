---
'@n3wtou/mnml-cms': minor
---

Image focal point: image values can store an optional `focalX` / `focalY` (0–1, both or neither), set in the admin by clicking a larger preview or with the arrow keys, with a Reset button. Uploading a new image clears it. `focalPosition(image)` returns the CSS `object-position` for it (`"50% 50%"` without one). Existing images read unchanged.
