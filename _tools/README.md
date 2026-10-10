# Marius FX tools (not published)

Build scripts, translations and test suites for the site. GitHub Pages runs Jekyll, which does not publish folders starting with `_`, so nothing here is served.

- `build_i18n.py --langs en,es,pt`: generates /en/, /es/, /pt/ from the Romanian pages + `i18n/<lang>/pages.json`, `i18n/<lang>/ui.json`, plus sitemap.xml.
- `i18n/`: translation dictionaries, extraction/merge helpers.
- `test-*.js`: Puppeteer suites (run against `python3 -m http.server 8765` in the site root, or BASE=<live url>). `LANGS=ro,en,es,pt node test-i18n.js`.
- `sim_update.sh`, `sim_build.py`, `sim_validate.py`, `sim_fetch*.`: simulator data pipeline (raw downloads in simdata/ are not stored here).
- Run `npm install` here to restore node_modules (puppeteer-core, acorn).
