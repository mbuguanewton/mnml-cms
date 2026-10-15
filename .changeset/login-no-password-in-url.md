---
'@n3wtou/mnml-cms': patch
---

The sign-in form no longer puts the password in the URL when it is submitted before the page's JavaScript is ready (or without JavaScript): it now posts to the login route, which signs in and redirects, or redirects back to the login page with an error. Signing in with JavaScript is unchanged.
