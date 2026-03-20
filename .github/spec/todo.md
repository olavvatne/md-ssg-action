# MD-SSG — Implementation Checklist

## Tasks

- [x] **01 — Project Scaffolding & Dependencies**
  - [x] `action.yml` with inputs and `node24` runtime
  - [x] `index.js` entry point calling `run()`
  - [x] `src/main.js` stub with `run()` export
  - [x] `package.json` with all deps, `build` and `test` scripts
  - [x] `npm install` succeeds
  - [x] `npm run build` produces `dist/index.js`

- [x] **02 — Config Parsing & Validation**
  - [x] `src/config.js` reads and parses `.md-ssg.yml`
  - [x] Validation rules enforced with descriptive errors
  - [x] Defaults applied for optional fields
  - [x] Unit tests pass (`test/config.test.js`)

- [x] **03 — Glob Filtering**
  - [x] `globFilter` in `src/filter.js` scans vault recursively
  - [x] Only `.md` files returned
  - [x] Glob patterns applied correctly
  - [x] Unit tests pass (`test/filter.test.js` — glob portion)

- [x] **04 — Tag Filtering**
  - [x] `tagFilter` in `src/filter.js` detects inline `#tag`
  - [x] Tags inside code blocks and inline code ignored
  - [x] Custom tag names supported
  - [x] Unit tests pass (`test/filter.test.js` — tag portion)

- [x] **05 — Image/Asset Extraction**
  - [x] `src/assets.js` detects standard and Obsidian image syntax
  - [x] Path resolution: file-relative → vault-relative
  - [x] External URLs skipped, duplicates removed
  - [x] Missing images produce warnings, not errors
  - [x] Unit tests pass (`test/assets.test.js`)

- [x] **06 — File Staging**
  - [x] `src/staging.js` creates staging dir in temp
  - [x] Glob prefix stripping works for all pattern types
  - [x] Files and images copied correctly
  - [x] Unit tests pass (`test/staging.test.js`)

- [x] **07 — Wiki-Links Remark Plugin**
  - [x] `src/wikilinks.js` resolves `[[links]]` to `<a>` or `<span>`
  - [x] Alias syntax, case-insensitive lookup
  - [x] Links in code blocks untouched
  - [x] Node splitting handles surrounding text
  - [x] Unit tests pass (`test/wikilinks.test.js`)

- [x] **08 — Render Pipeline**
  - [x] `src/render.js` unified processor produces correct HTML
  - [x] YAML frontmatter stripped
  - [x] Title extracted from first H1
  - [x] Wiki-links integrated
  - [x] Unit tests pass (`test/render.test.js`)

- [x] **09 — Built-in Templates & CSS**
  - [x] `src/templates.js` page layout, index page, default stylesheet
  - [x] Dark/light mode, responsive, `.dead-link` styling
  - [x] `basePath` applied to all links
  - [x] Unit tests pass (`test/templates.test.js`)

- [x] **10 — Template Override System**
  - [x] Override detection via `_templates/page.html`
  - [x] `{{placeholder}}` substitution
  - [x] Fallback for missing optional overrides
  - [x] Unit tests pass

- [x] **11 — Build Orchestration**
  - [x] `src/build.js` wires rendering, templating, image copy, output
  - [x] Wiki-link map built from staged files
  - [x] Directory-style URLs (`/path/index.html`)
  - [x] Index page with folder grouping
  - [x] Render failures handled gracefully
  - [x] Unit tests pass (`test/build.test.js`)

- [x] **12 — Main Orchestrator & Integration Test**
  - [x] `src/main.js` complete pipeline wiring
  - [x] Integration test with mock vault
  - [x] Published files in output, unpublished excluded
  - [x] Wiki-links, images, index, stylesheet all correct
  - [x] `npm run build` produces working `dist/index.js`
