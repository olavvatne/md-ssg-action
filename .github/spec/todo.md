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

- [ ] **04 — Tag Filtering**
  - [ ] `tagFilter` in `src/filter.js` detects inline `#tag`
  - [ ] Tags inside code blocks and inline code ignored
  - [ ] Custom tag names supported
  - [ ] Unit tests pass (`test/filter.test.js` — tag portion)

- [ ] **05 — Image/Asset Extraction**
  - [ ] `src/assets.js` detects standard and Obsidian image syntax
  - [ ] Path resolution: file-relative → vault-relative
  - [ ] External URLs skipped, duplicates removed
  - [ ] Missing images produce warnings, not errors
  - [ ] Unit tests pass (`test/assets.test.js`)

- [ ] **06 — File Staging**
  - [ ] `src/staging.js` creates staging dir in temp
  - [ ] Glob prefix stripping works for all pattern types
  - [ ] Files and images copied correctly
  - [ ] Unit tests pass (`test/staging.test.js`)

- [ ] **07 — Wiki-Links Remark Plugin**
  - [ ] `src/wikilinks.js` resolves `[[links]]` to `<a>` or `<span>`
  - [ ] Alias syntax, case-insensitive lookup
  - [ ] Links in code blocks untouched
  - [ ] Node splitting handles surrounding text
  - [ ] Unit tests pass (`test/wikilinks.test.js`)

- [ ] **08 — Render Pipeline**
  - [ ] `src/render.js` unified processor produces correct HTML
  - [ ] YAML frontmatter stripped
  - [ ] Title extracted from first H1
  - [ ] Wiki-links integrated
  - [ ] Unit tests pass (`test/render.test.js`)

- [ ] **09 — Built-in Templates & CSS**
  - [ ] `src/templates.js` page layout, index page, default stylesheet
  - [ ] Dark/light mode, responsive, `.dead-link` styling
  - [ ] `basePath` applied to all links
  - [ ] Unit tests pass (`test/templates.test.js`)

- [ ] **10 — Template Override System**
  - [ ] Override detection via `_templates/page.html`
  - [ ] `{{placeholder}}` substitution
  - [ ] Fallback for missing optional overrides
  - [ ] Unit tests pass

- [ ] **11 — Build Orchestration**
  - [ ] `src/build.js` wires rendering, templating, image copy, output
  - [ ] Wiki-link map built from staged files
  - [ ] Directory-style URLs (`/path/index.html`)
  - [ ] Index page with folder grouping
  - [ ] Render failures handled gracefully
  - [ ] Unit tests pass (`test/build.test.js`)

- [ ] **12 — Main Orchestrator & Integration Test**
  - [ ] `src/main.js` complete pipeline wiring
  - [ ] Integration test with mock vault
  - [ ] Published files in output, unpublished excluded
  - [ ] Wiki-links, images, index, stylesheet all correct
  - [ ] `npm run build` produces working `dist/index.js`
