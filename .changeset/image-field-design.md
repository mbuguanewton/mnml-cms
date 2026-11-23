---
'@n3wtou/mnml-cms': minor
---

New `image` field design in the admin. An empty field is a drop zone (drop a file, click, or "browse"; "Choose from uploads" when the storage can list). A filled field is a wide preview with an icon toolbar on top (Replace, Choose from uploads, Focal point, Remove) and a `filename · width×height` chip, so the actions no longer overflow in narrow columns. Not breaking: the stored value and API are unchanged.
