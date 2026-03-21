# Task 14 — Refactor: Deduplicate Utilities, Externalize Templates & CSS

## Goal

Reduce duplication across `src/`, extract inlined HTML and CSS into standalone template files consumed by the existing override system, and consolidate shared utility functions into a single module.

## Scope

### 14.1 — Extract Shared Utilities into `src/utils.js`

#### Duplicated Functions

| Function | Currently in | Identical? |
|---|---|---|
| `normalizePath` | `build.js`, `filter.js`, `staging.js`, `assets.js` | Yes |
| `normalizeBasePath` | `build.js`, `templates.js` | Yes |
| `escapeHtml` | `templates.js`, `wikilinks.js` | Yes (minor `String()` wrapper diff) |
| `fileExists` / `exists` | `templates.js`, `assets.js` | Yes (different names) |

#### Action

1. Create `src/utils.js` exporting:
   - `normalizePath(filePath)` — backslash to forward slash
   - `normalizeBasePath(basePath)` — strip trailing slash, collapse `/` to `""`
   - `escapeHtml(value)` — escape `& < > " '`
   - `fileExists(filePath)` — async access check

2. Replace all inline copies in consuming modules with imports from `src/utils.js`.

3. Remove the now-dead local definitions from:
   - `src/build.js` — `normalizePath`, `normalizeBasePath`
   - `src/filter.js` — `normalizePath`
   - `src/staging.js` — `normalizePath`
   - `src/assets.js` — `normalizePath`, `exists`
   - `src/templates.js` — `normalizeBasePath`, `escapeHtml`, `fileExists`
   - `src/wikilinks.js` — `escapeHtml`

4. Add `test/utils.test.js` with focused tests for each exported function.

### 14.2 — Externalize Default HTML Templates

#### Problem

`renderPage` and `renderIndex` in `src/templates.js` contain hardcoded HTML as JS template literals. Custom templates already go through `applyTemplate(template, replacements)`. The built-in defaults bypass this, creating two code paths.

#### Action

1. Create default template files:
   - `src/defaults/page.html` — the built-in page template with `{{placeholder}}` syntax
   - `src/defaults/index.html` — the built-in index template with `{{placeholder}}` syntax

2. Refactor `renderPage` and `renderIndex` to:
   - Load the default HTML string (imported or read at init)
   - Call `applyTemplate(defaultTemplate, { ... })` — the same path custom templates use
   - Pre-escape dynamic values before passing to `applyTemplate`

3. Introduce additional placeholders as needed to cover built-in features:

   | Placeholder | Available in | Value |
   |---|---|---|
   | `{{content}}` | `page.html` | Rendered markdown HTML |
   | `{{title}}` | `page.html`, `index.html` | Escaped page or site title |
   | `{{basePath}}` | `page.html`, `index.html` | Normalized URL prefix |
   | `{{siteTitle}}` | `page.html` | Escaped site title |
   | `{{pages}}` | `index.html` | Pre-rendered page list sections HTML |
   | `{{faviconHref}}` | `page.html`, `index.html` | `{{basePath}}/favicon.svg` |
   | `{{stylesheetHref}}` | `page.html`, `index.html` | `{{basePath}}/style.css` |
   | `{{indexHref}}` | `page.html` | `{{basePath}}/` |

4. `resolveTemplates` should fall back to the default template files when no `_templates/page.html` is found — unifying the code path.

### 14.3 — Externalize Default CSS and Favicon CSS

#### Problem

`defaultStylesheet()` returns ~100 lines of CSS as a JS string literal. `defaultFavicon()` contains an inline `<style>` block for dark-mode color switching. Both are harder to maintain than standalone files.

#### Action

1. Create default asset files:
   - `src/defaults/style.css` — the built-in stylesheet
   - `src/defaults/favicon.svg` — the built-in favicon (with embedded dark-mode `<style>`)

2. Refactor `defaultStylesheet` and `defaultFavicon` to read from these files (or import them as string constants at build time).

3. `resolveTemplates` should fall back to reading from `src/defaults/` when no custom override exists.

## File Summary

| File | Action |
|---|---|
| `src/utils.js` | Create — shared utility functions |
| `test/utils.test.js` | Create — tests for shared utilities |
| `src/defaults/page.html` | Create — default page template |
| `src/defaults/index.html` | Create — default index template |
| `src/defaults/style.css` | Create — default stylesheet |
| `src/defaults/favicon.svg` | Create — default favicon |
| `src/templates.js` | Refactor — use `applyTemplate` for built-in path, import utils |
| `src/build.js` | Refactor — import utils, remove local copies |
| `src/filter.js` | Refactor — import `normalizePath` from utils |
| `src/staging.js` | Refactor — import `normalizePath` from utils |
| `src/assets.js` | Refactor — import `normalizePath`, `fileExists` from utils |
| `src/wikilinks.js` | Refactor — import `escapeHtml` from utils |

## Constraints

- All existing tests must continue to pass after refactoring.
- No new dependencies.
- Default template files must produce byte-identical output to current built-in functions.
- The `applyTemplate` function and override detection logic stay in `src/templates.js`.
- ESM only — use `import` for the new module.

## Acceptance Criteria

- [ ] `src/utils.js` exports `normalizePath`, `normalizeBasePath`, `escapeHtml`, `fileExists`
- [ ] `test/utils.test.js` covers each exported function
- [ ] No duplicate utility definitions remain in any `src/` file
- [ ] Default HTML templates exist as `.html` files under `src/defaults/`
- [ ] Built-in and custom templates share the same `applyTemplate` code path
- [ ] Default stylesheet and favicon exist as standalone files under `src/defaults/`
- [ ] All existing tests pass (`npm test`) with no changes to assertions
- [ ] Generated output is byte-identical before and after refactor
