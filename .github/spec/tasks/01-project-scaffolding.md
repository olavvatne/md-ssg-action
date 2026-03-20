# Task 01 — Project Scaffolding & Dependencies

## Goal

Set up the project structure, `action.yml`, entry point, and install all dependencies so subsequent tasks have a working foundation.

## Scope

- **`action.yml`** — Define inputs (`markdown-location`, `site-location`), set `runs.using: node24`, entry point `dist/index.js`.
- **`index.js`** — Minimal entry point that imports and calls `run()` from `src/main.js`.
- **`src/main.js`** — Stub with an exported `run()` that logs "md-ssg starting" and reads inputs (no real logic yet).
- **`package.json`** — Add all runtime and dev dependencies, `build` and `test` scripts.
- **Install dependencies** — `npm install`.
- **`.gitignore`** — Ensure `node_modules/` is ignored; `dist/` is **not** ignored (committed per action convention).

## Dependencies to Install

### Runtime

| Package | Purpose |
|---|---|
| `unified` | Pipeline framework |
| `remark-parse` | Markdown → mdast |
| `remark-frontmatter` | Strip YAML frontmatter from AST |
| `remark-rehype` | mdast → hast bridge |
| `rehype-stringify` | hast → HTML string |
| `unist-util-visit` | AST tree walker |
| `js-yaml` | Parse `.md-ssg.yml` |
| `@actions/core` | GitHub Action logging, inputs, setFailed |
| `@actions/github` | GitHub context (repo name for defaults) |

### Dev

| Package | Purpose |
|---|---|
| `@vercel/ncc` | Bundle into `dist/index.js` |

Tests use Node.js built-in `node:test` — no test framework dependency.

## `action.yml` Content

```yaml
name: "MD-SSG"
description: "Convert Obsidian markdown files into a static site for GitHub Pages"
inputs:
  markdown-location:
    description: "Path to the Obsidian vault root (relative to repo root)"
    required: false
    default: "."
  site-location:
    description: "Output directory for the generated site"
    required: false
    default: "_site"
runs:
  using: node24
  main: dist/index.js
```

## `package.json` Scripts

```json
{
  "scripts": {
    "build": "ncc build index.js -o dist",
    "test": "node --test"
  }
}
```

## Acceptance Criteria

- [ ] `npm install` succeeds
- [ ] `npm test` runs (no tests yet, but `node --test` executes without error)
- [ ] `npm run build` produces `dist/index.js`
- [ ] `action.yml` is valid and references `dist/index.js`
- [ ] `index.js` imports `run` from `src/main.js` and calls it
- [ ] `src/main.js` exports an async `run()` that reads inputs via `core.getInput()`

## Spec References

- §1 (Action Interface)
- §6 (File Map)
- §7 (Dependencies)
- §10 (Build & Distribution)
