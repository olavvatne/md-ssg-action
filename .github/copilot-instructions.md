# Project Guidelines

## Overview

GitHub Action (`action.yml`, Node 24 runtime) that converts a repository of Markdown files into a static site for GitHub Pages. Two-layer publish model: files must match a glob pattern **and** contain an inline tag (default `#publish`).

## Architecture

- **No frameworks** — remark/rehype AST pipeline, JS template literals, `fs.glob()` for file discovery.
- Pipeline: `remark-parse → remark-frontmatter → remarkWikiLinks → remark-rehype → rehype-stringify`

## Specification-Driven Development

All design decisions, module APIs, edge cases, and test cases are defined in `.github/spec/`:

- [spec.md](.github/spec/spec.md) — full architecture and behaviour spec
- Task files (`01-*.md` through `12-*.md`) — implementation tasks with exact function signatures, file paths, and unit test expectations

**Always read the relevant task file before implementing a module.** Do not invent APIs or deviate from the spec unless the user explicitly asks.

## Code Style

- **ESM only** — `"type": "module"` in `package.json`. Use `import`/`export`, never `require`.
- **Node 24** — leverage modern APIs (`fs.glob()`, `fs.cp()`, structured clone, etc.). No polyfills.
- **Pure functions preferred** — modules export functions, not classes. Keep side effects (file I/O) at the edges.
- Descriptive names; no abbreviations beyond common ones (`src`, `dir`, `config`).

## Project Structure

```
index.js              # Entry point, calls src/main.js
src/
  main.js             # run() — orchestrates the action
  config.js           # parseConfig() — reads .md-ssg.yml
  filter.js           # globFilter(), tagFilter()
  assets.js           # extractImages()
  staging.js          # stageFiles()
  wikilinks.js        # remarkWikiLinks plugin
  render.js           # renderMarkdown()
  templates.js        # built-in + override templates
  build.js            # buildSite() — orchestrates output
```

New source files go in `src/`. Do not add top-level source files.

## GitHub Actions Conventions

- Read inputs via `@actions/core`: `core.getInput('markdown-location')`.
- Report errors via `core.setFailed(error.message)` — never `process.exit(1)`.
- Use `core.debug()` / `core.info()` for logging, not `console.log()`.
- The action must be bundled into `dist/index.js` for release (ncc or esbuild). During development, `index.js` is the direct entry point.

## Testing

- Test runner: Node built-in (`node --test`)
- Test files live alongside source: `src/__tests__/` or `src/*.test.js`.
- Each task file in `.github/spec/` lists exact test cases — use those as the baseline.
- Prefer real filesystem fixtures in a `test/` directory over mocks for integration tests.

## Key Design Decisions (Do Not Change)

| Decision                                           | Rationale                                       |
| -------------------------------------------------- | ----------------------------------------------- |
| `fs.glob()` not globby/fast-glob                   | Zero dependencies for file discovery            |
| Inline tag detection, not frontmatter              | Works with Obsidian vaults as-is                |
| `{{placeholder}}` templates, not a template engine | Minimal, no new syntax to learn                 |
| Directory-style URLs (`/folder/file/index.html`)   | Clean URLs on GitHub Pages                      |
| Wiki-link resolution via lookup map                | Case-insensitive, handles dead links gracefully |
