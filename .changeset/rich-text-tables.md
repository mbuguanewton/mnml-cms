---
'@n3wtou/mnml-cms': minor
---

Tables in rich text: `import { tables } from '@n3wtou/mnml-cms/table'` and spread `tables.extensions` and `tables.tools` into `defineEditor`. Adds an "Insert table" button, and a small toolbar above the table (while the cursor is in it) for rows, columns, the header row and deleting the table. `<RichText>` renders a plain `<table>`; the admin has table styles. A separate entry point, so sites without tables don't load the table code. Tools can now take `visible(editor)` to show only sometimes, and `context: '<node>'` to show in a small toolbar above that node instead of the main toolbar. In each toolbar group, the package's ready-made tools now come before the site's own.
