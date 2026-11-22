---
'@n3wtou/mnml-cms': minor
---

Own date picker for `date` and `datetime` fields: type `YYYY-MM-DD` or pick from a calendar popover (arrows, Home/End, PageUp/PageDown by month, Shift by year, Enter, Escape). Impossible dates are marked invalid. Datetime fields take `YYYY-MM-DD HH:mm` in one box, with the time picked in the calendar (a time row with hour and minute lists, and Done; no native time popup); picking another day keeps the time. `DatePicker` takes `time` for a separate time box, or `time` + `timeInCalendar` for the combined one. Touch screens keep the browser's own picker. New `DatePicker` component and `DatePicker` slot for the `ui` option. No new dependencies (date maths on the existing `date-fns`). Not breaking.
