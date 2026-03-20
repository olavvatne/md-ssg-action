# Task 09 — Built-in Templates & CSS

## Goal

Implement `src/templates.js` — page layout, index page, and default stylesheet using template literals.

## Scope

### `src/templates.js`

**Exports**:
- `renderPage(data: PageData): string`
- `renderIndex(data: IndexData): string`
- `defaultStylesheet(): string`

**`renderPage`** — complete HTML document:
- `<html lang="en">` with `<meta charset="utf-8">`, `<meta name="viewport">`.
- `<title>` = page title + " — " + site title.
- `<link>` to `style.css` (via `basePath`).
- `<nav>` with link back to index (`basePath + "/"`).
- `<article>` wrapping the content HTML.

**`renderIndex`** — complete HTML document:
- Same boilerplate head.
- `<h1>` with site title.
- Pages grouped by `folder`, each group as a `<section>` with `<h2>` folder name.
- Each page as a list item with link.
- Pages with empty folder go under an ungrouped section.

**`defaultStylesheet`** — CSS string:
- System-preference dark/light via `prefers-color-scheme`.
- Responsive layout (max-width content area, readable line length).
- `.dead-link` styling: grey text, no underline, slightly dimmed.
- Basic typography: system font stack, heading sizes, paragraph spacing.
- Nav styling.

### Types

```ts
interface PageData {
  title: string;
  content: string;
  basePath: string;
  siteTitle: string;
}

interface IndexData {
  title: string;
  pages: PageEntry[];
  basePath: string;
}

interface PageEntry {
  title: string;
  url: string;
  folder: string;
}
```

## Tests — `src/templates.test.js`

| Test case | Expected |
|---|---|
| `renderPage` output | Valid HTML with title, content, nav, stylesheet link |
| `renderIndex` with grouped pages | Sections per folder with links |
| `renderIndex` with empty pages array | Valid HTML, no crash |
| `renderIndex` ungrouped pages | Pages without folder still listed |
| Default stylesheet | Contains `prefers-color-scheme`, `.dead-link`, responsive rules |
| `basePath` appears in links | Stylesheet href and nav links use basePath |

## Acceptance Criteria

- [ ] `renderPage` produces valid, complete HTML documents
- [ ] `renderIndex` groups pages by folder correctly
- [ ] Default stylesheet handles dark/light mode and responsive layout
- [ ] `basePath` correctly applied to all internal links
- [ ] All unit tests pass

## Spec References

- §4.7 (templates.js module spec)
