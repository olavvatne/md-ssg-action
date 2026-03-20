# Task 10 — Template Override System

## Goal

Add support for user-provided template overrides via `_templates/` directory in the vault root.

## Scope

### Changes to `src/templates.js` (or new helper)

**Detection**: Check for existence of `_templates/page.html` in vault root.

**Mode**: All-or-nothing. If `_templates/page.html` exists, the override system activates.

**Expected override files**:

| File | Required | Fallback |
|---|---|---|
| `_templates/page.html` | yes (trigger) | — |
| `_templates/index.html` | no | built-in `renderIndex` |
| `_templates/style.css` | no | built-in `defaultStylesheet` |

**Placeholder syntax** — simple `{{key}}` replacement via `String.replaceAll()`:

| Placeholder | Available in | Value |
|---|---|---|
| `{{content}}` | page.html | Rendered HTML of the markdown file |
| `{{title}}` | page.html, index.html | Page title or site title |
| `{{basePath}}` | page.html, index.html | URL prefix |
| `{{siteTitle}}` | page.html | Site title from config |
| `{{pages}}` | index.html | Pre-rendered HTML list of pages |

**Implementation**: Read template file, do `template.replaceAll("{{content}}", data.content)` for each placeholder. No nested templates, no conditionals, no loops — flat substitution only.

### Integration with `build.js` (prepared for Task 11)

Export a function to resolve which template renderer to use:
- `resolveTemplates(vaultRoot: string): Promise<TemplateSet>`
- Returns either built-in functions or override-based renderers.

## Tests

| Test case | Expected |
|---|---|
| No `_templates/` directory | Built-in templates used |
| `_templates/page.html` exists | Override mode activated |
| Override page template with placeholders | Placeholders replaced correctly |
| Missing `_templates/index.html` | Falls back to built-in index |
| Missing `_templates/style.css` | Falls back to built-in stylesheet |
| All three override files present | All custom templates used |

## Acceptance Criteria

- [ ] Override detection based on `_templates/page.html` existence
- [ ] Placeholder substitution works for all defined placeholders
- [ ] Fallback to built-in for missing optional override files
- [ ] All unit tests pass

## Spec References

- §4.8 (Template Override System)
