# Task 13 — README & Usage Documentation

## Goal

Replace the placeholder `README` with a polished `README.md` that explains the action, shows configuration, and provides copy-paste workflow examples.

## Scope

### Files

| File | Action |
|---|---|
| `README.md` | Create — full project documentation |
| `README` | Delete — replaced by `README.md` |

### Sections to Write

#### 1. Hero

- `# MD-SSG` heading
- One-line description: _"A GitHub Action that converts a repository of Markdown files into a static site for GitHub Pages."_
- License badge only (no CI badge — no workflow exists yet)

#### 2. Overview

- Two-layer publish model: files must match a glob pattern **and** contain an inline `#publish` tag.
- Remark/rehype pipeline, wiki-link resolution, directory-style clean URLs.
- Works with any `[[wiki-link]]`-based tool — Foam, Obsidian, or plain Markdown.
- No framework dependency — minimal, fast, zero-config defaults.

#### 3. Quick Start

Minimal three-step guide:

1. Add `.md-ssg.yml` to your workspace root.
2. Add workflow file.
3. Push — site appears on GitHub Pages.

Include a short inline workflow snippet (checkout → md-ssg → upload artifact → deploy pages).

#### 4. Config Reference — `.md-ssg.yml`

Table of fields from §2.1:

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `include` | `string[]` | yes | — | Glob patterns for candidate files |
| `tag` | `string` | no | `"publish"` | Inline tag name (without `#`) |
| `title` | `string` | no | repo name | Site title |
| `base-path` | `string` | no | `"/<repo>"` | URL path prefix |

Include a realistic example YAML block.

#### 5. How Publishing Works

Short explanation:

1. Glob filter selects `.md` files matching `include` patterns.
2. Tag filter keeps only files containing `#<tag>` in body text (not in code blocks/inline code).
3. Files outside the glob or without the tag are excluded — two layers of intent.
4. Wiki-links (`[[Target]]`, `[[Target|Display]]`) resolve to published pages or dead-link spans.

#### 6. Template Overrides

- Detection trigger: `_templates/page.html` in workspace root.
- Optional files: `_templates/index.html`, `_templates/style.css`.
- Placeholder table:

| Placeholder | Available in | Value |
|---|---|---|
| `{{content}}` | page.html | Rendered markdown HTML |
| `{{title}}` | page.html, index.html | Page or site title |
| `{{basePath}}` | page.html, index.html | URL prefix |
| `{{siteTitle}}` | page.html | Site title from config |
| `{{pages}}` | index.html | Pre-rendered page list HTML |

Include a minimal `page.html` override example.

#### 7. Full Workflow Example

Complete `.github/workflows/deploy.yml`:

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

#### 8. Example Workspace Layout

```
my-notes/
├── .md-ssg.yml
├── _templates/          # optional overrides
│   ├── page.html
│   └── style.css
├── Notes/
│   ├── Getting Started.md   # contains #publish
│   ├── Advanced Topics.md   # contains #publish
│   └── Draft.md             # no tag → excluded
├── Recipes/
│   ├── Pasta.md             # contains #publish
│   └── images/
│       └── pasta.jpg
└── Private/
    └── Journal.md           # outside include glob → excluded
```

With `.md-ssg.yml`:
```yaml
include:
  - "Notes/**"
  - "Recipes/**"
tag: "publish"
title: "My Knowledge Base"
```

#### 9. Local Development

```
npm install
npm test                    # node --test
npm run build               # ncc → dist/index.js
npx @github/local-action run . src/main.js .env
```

#### 10. License

Single line: `MIT — see [LICENSE](LICENSE)`.

## Style Guidelines

- Keep it scannable: short paragraphs, tables over prose, code blocks for all config/workflow.
- No screenshots (action produces HTML, not a visual tool).
- Use standard GitHub markdown (no HTML unless needed for badges).
- Target audience: someone who keeps Markdown notes (Foam, Obsidian, Dendron, or plain files) and wants to publish parts of them to GitHub Pages.

## Acceptance Criteria

- [ ] `README.md` created with all sections above
- [ ] Old extensionless `README` file deleted
- [ ] Workflow example is valid GitHub Actions YAML
- [ ] Config example matches §2.1 spec
- [ ] Template override section matches §4.8 spec
- [ ] All placeholder names match implementation in `src/templates.js`

## Spec References

- §1 (Action Interface)
- §2 (Config File)
- §4.8 (Template Override System)
- §5 (URL Structure)
