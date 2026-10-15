---
'@n3wtou/mnml-cms': minor
---

`blocks` fields add a section from one "Add section" button that opens a picker, instead of a row of buttons that grows with every block. The picker has a search box once there are more than eight blocks and works with the keyboard. `block(label, fields, { description })` adds a one-line hint under each block's name, and `fields.blocks(label, blocks, { addLabel })` renames the button.
