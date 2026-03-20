# MD-SSG

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A GitHub Action that converts a repository of Markdown files into a static site for GitHub Pages.

## Overview

MD-SSG uses a two-layer publish model:

1. A file must match one of your include glob patterns.
2. The file must contain an inline publish tag (default: `#publish`).

It uses a remark/rehype pipeline for Markdown rendering, resolves wiki-links, and emits directory-style clean URLs for pages.

It works with any `[[wiki-link]]` workflow, including Foam, Obsidian, or plain Markdown notes.

No framework dependency, minimal setup, and fast defaults.

## Quick Start

1. Add `.md-ssg.yml` to your repository root.
2. Add a GitHub Pages workflow.
3. Push to `main` and your site is published on GitHub Pages.

Minimal workflow snippet:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: <owner>/md-ssg-action@v1
        with:
          markdown-location: "."
          site-location: "_site"
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/deploy-pages@v4
```

## Config Reference (.md-ssg.yml)

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `include` | `string[]` | yes | - | Glob patterns for candidate files |
| `tag` | `string` | no | `"publish"` | Inline tag name (without `#`) |
| `title` | `string` | no | repo name | Site title |
| `base-path` | `string` | no | `"/<repo>"` | URL path prefix |

Example:

```yaml
include:
  - "Notes/**"
  - "Recipes/**"
tag: "publish"
title: "My Knowledge Base"
base-path: "/my-notes"
```

## How Publishing Works

1. Glob filtering selects `.md` files matching `include` patterns.
2. Tag filtering keeps only files containing `#<tag>` in body text (not inside fenced code blocks or inline code).
3. Files outside the glob patterns or missing the tag are excluded.
4. Wiki-links (`[[Target]]`, `[[Target|Display]]`) resolve to published pages when possible, otherwise a dead-link span is rendered.

This two-layer model makes publishing explicit and safe.

## Template Overrides

Template overrides are enabled when `_templates/page.html` exists in your repository root.

Optional companion files:

- `_templates/index.html`
- `_templates/style.css`

Placeholders:

| Placeholder | Available in | Value |
|---|---|---|
| `{{content}}` | `page.html` | Rendered markdown HTML |
| `{{title}}` | `page.html`, `index.html` | Page title or site title |
| `{{basePath}}` | `page.html`, `index.html` | URL prefix |
| `{{siteTitle}}` | `page.html` | Site title from config |
| `{{pages}}` | `index.html` | Pre-rendered page list HTML |

Minimal `page.html` override:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{title}} | {{siteTitle}}</title>
    <link rel="stylesheet" href="{{basePath}}/style.css">
  </head>
  <body>
    <main>
      {{content}}
    </main>
  </body>
</html>
```

## Full Workflow Example

```yaml
name: Deploy to Pages

on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: <owner>/md-ssg-action@v1
        with:
          markdown-location: "."
          site-location: "_site"
      - uses: actions/upload-pages-artifact@v3
        with:
          path: _site

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

## Example Workspace Layout

```text
my-notes/
├── .md-ssg.yml
├── _templates/          # optional overrides
│   ├── page.html
│   └── style.css
├── Notes/
│   ├── Getting Started.md   # contains #publish
│   ├── Advanced Topics.md   # contains #publish
│   └── Draft.md             # no tag -> excluded
├── Recipes/
│   ├── Pasta.md             # contains #publish
│   └── images/
│       └── pasta.jpg
└── Private/
    └── Journal.md           # outside include glob -> excluded
```

With `.md-ssg.yml`:

```yaml
include:
  - "Notes/**"
  - "Recipes/**"
tag: "publish"
title: "My Knowledge Base"
```

## Local Development

```bash
npm install
npm test
npm run build
npx @github/local-action run . src/main.js .env
npx serve _site -l 4173
```

## License

MIT - see [LICENSE](LICENSE)
