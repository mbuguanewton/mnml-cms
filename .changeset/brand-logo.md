---
'@n3wtou/mnml-cms': minor
---

Show your logo in the admin. `brand` now also takes `{ name, logo }`, where `logo` is a URL, `{ src, dark?, alt?, wordmark? }` (a dark-theme image, or a wordmark that hides the name) or a React element. It shows in the sidebar and on the sign-in page, and falls back to the letter tile if the image fails to load. A string `brand`, or a function returning one, works as before. New types `BrandOption` and `BrandLogo`.
