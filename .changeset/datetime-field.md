---
'@n3wtou/mnml-cms': minor
---

New `fields.datetime(label)`: a moment in time, stored in UTC as one ISO format (`2026-11-18T14:30:00.000Z`), so `orderBy` sorts it chronologically. The admin edits it with a `datetime-local` input in the editor's time zone and names that zone. Saved values need a `Z` or an offset and are converted to UTC; impossible dates are rejected. Works with `default` (e.g. `() => new Date().toISOString()`). Adds `date-fns` as a dependency.
