---
'@n3wtou/mnml-cms': patch
---

Fix: the "Add section" list and the entry picker (`reference` and `references` fields) no longer push the page. They opened as plain boxes in the page layout, so near the bottom of a form they made the page taller and left empty space after closing, and they ran off the bottom of a short window. They are now popovers like the other admin menus: above the page, flipped above the button when there is no room, shrunk to fit (the list scrolls inside), and following the button when the page scrolls.
