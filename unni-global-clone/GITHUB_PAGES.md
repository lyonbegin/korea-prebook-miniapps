# UNNI GitHub Pages migration

Source: bc655946dea838483d970beed4ec910f0dd0abe7. Frontend deployment only; backend and PostgreSQL unchanged.

Pages URL: https://lyonbegin.github.io/korea-prebook-miniapps/unni/
Hash routes keep reloads and direct option links inside the static site. Existing Railway build retains history routing. Browser API base: https://unni-mobile-api-production.up.railway.app (requires a healthy API and CORS origin https://lyonbegin.github.io).

Shared gh-pages branch: UNNI publishes only unni/; MyDoctor must preserve that directory. No database credentials are included in the frontend.
