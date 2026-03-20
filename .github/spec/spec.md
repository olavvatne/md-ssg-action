# MD-SSG — Obsidian-to-GitHub-Pages Action

> **Version**: 1.0 spec — 20 March 2026

A GitHub Action that converts a subset of Obsidian markdown files into a static site for GitHub Pages. Files are published only when they match an include glob **AND** contain an inline `#publish` tag — two layers of intent to prevent accidental leaks. The action handles the build; deployment is left to standard GitHub Pages actions.

**Key design choices**: remark/rehype AST pipeline (no framework), JS template literals (no template engine), `fs.glob()` (no file-crawler dependency), inline-only tag detection (no frontmatter parsing).

---

## 1. Action Interface

### 1.1 `action.yml` Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `markdown-location` | no | `"."` | Path to the Obsidian vault root (relative to repo root) |
| `site-location` | no | `"_site"` | Output directory for the generated site |

No other inputs. All site configuration lives in `.md-ssg.yml` inside the vault.

### 1.2 Runtime

- `runs.using: node24`
- Entry point: `dist/index.js` (bundled with `ncc`)

### 1.3 Outputs

None. The action writes HTML/CSS/images to `site-location`. The user's workflow is responsible for deploying via `actions/upload-pages-artifact` + `actions/deploy-pages`.

---

## 2. Config File — `.md-ssg.yml`

Located at the vault root (`markdown-location`). Read and validated before any processing.

```yaml
include:                        # REQUIRED — non-empty array
  - "Recipes/**"
  - "Tech/**"
tag: "publish"                  # optional, default: "publish"
title: "My Site"                # optional, default: repo name
base-path: "/repo-name"         # optional, default: auto-detect
```

### 2.1 Fields

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `include` | `string[]` | **yes** | — | Glob patterns relative to vault root. Only `.md` files matching at least one pattern are candidates. |
| `tag` | `string` | no | `"publish"` | Inline tag name (without `#`). Files must contain `#<tag>` to be published. |
| `title` | `string` | no | Repository name from `github.context.repo.repo` | Site title shown in index page and page layouts. |
| `base-path` | `string` | no | `"/<repo-name>"` derived from `github.context.repo` | URL path prefix. Prepended to all internal links and asset URLs. Must start with `/`. |

### 2.2 Validation Rules

- File must exist and be valid YAML.
- `include` must be present, must be an array, must have at least one entry.
- `include` entries must be strings.
- `tag` if present must be a non-empty string containing only word characters (`[a-zA-Z0-9_-]`).
- `base-path` if present must start with `/` and not end with `/` (unless it is exactly `/`).
- Unknown keys are silently ignored (forward-compatible).

### 2.3 Error Behavior

| Condition | Error |
|---|---|
| `.md-ssg.yml` not found | `core.setFailed("Missing .md-ssg.yml in vault root: <path>")` |
| Invalid YAML | `core.setFailed("Invalid YAML in .md-ssg.yml: <parse error>")` |
| `include` missing or empty | `core.setFailed(".md-ssg.yml: 'include' must be a non-empty array of glob patterns")` |
| `tag` invalid format | `core.setFailed(".md-ssg.yml: 'tag' must contain only word characters")` |
| `base-path` invalid format | `core.setFailed(".md-ssg.yml: 'base-path' must start with '/'")` |

---

## 3. Architecture

### 3.1 High-Level Pipeline

```
action.yml inputs
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  config.js   │────▶│  filter.js   │────▶│  staging.js  │
│  parse+validate    │  glob + tag  │     │  copy + strip │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                  │
                     ┌──────────────┐             │
                     │  assets.js   │◀────────────┤
                     │  image refs  │             │
                     └──────┬───────┘             │
                            │                     │
                            ▼                     ▼
                     ┌─────────────────────────────────┐
                     │           build.js               │
                     │  render each file (render.js)    │
                     │  wrap in layout (templates.js)   │
                     │  generate index page             │
                     │  copy images + style.css         │
                     └─────────────────────────────────┘
                                    │
                                    ▼
                              site-location/
```

### 3.2 Render Pipeline (per file)

```
markdown string
  → remark-parse          (string → mdast)
  → remark-frontmatter    (strip YAML blocks from AST)
  → remarkWikiLinks       (custom plugin: resolve [[wiki-links]])
  → remark-rehype         (mdast → hast)
  → rehype-stringify       (hast → HTML string)
```

Title extraction happens during the remark phase by visiting the first `heading` node with `depth: 1`.

---

## 4. Module Specifications

### 4.1 `src/config.js` — Parse & Validate Config

**Exports**: `parseConfig(vaultRoot: string, deps?): Promise<Config>`

`deps` defaults to `{ github: await import("@actions/github") }`. Tests inject a mock `github` object to control `context.repo.repo` without module mocking.

**Config type**:
```ts
interface Config {
  include: string[];      // glob patterns
  tag: string;            // tag name without '#'
  title: string;          // site title
  basePath: string;       // URL prefix, e.g. "/repo-name"
}
```

**Behavior**:
1. Read `path.join(vaultRoot, ".md-ssg.yml")` as UTF-8.
2. Parse with `js-yaml`.
3. Validate per §2.2 rules.
4. Apply defaults: `tag` → `"publish"`, `title` → `deps.github.context.repo.repo`, `base-path` → `"/" + deps.github.context.repo.repo`.
5. Return normalized `Config` object.
6. Throw descriptive error on any validation failure.

**Edge cases**:
- Empty file → YAML parses as `null` → fail with missing `include` error.
- `include: "single-pattern"` (string, not array) → wrap in array for convenience, or reject. **Decision**: reject. Require array syntax to be explicit.

---

### 4.2 `src/filter.js` — Glob + Tag Filtering

**Exports**:
- `globFilter(vaultRoot: string, patterns: string[]): Promise<{ files: string[], patternMap: Map<string, string> }>`
- `tagFilter(vaultRoot: string, files: string[], tag: string): Promise<string[]>`

#### `globFilter`

1. For each pattern, call `fs.glob(pattern, { cwd: vaultRoot })` — returns matching paths with directory pruning.
2. For each matched file, record which pattern first matched it in `patternMap` (Map<filePath, pattern>).
3. Collect results across all patterns into a `Set` (deduplication).
4. Filter to entries ending in `.md`.
5. Normalize path separators to `/` (Windows safety even though action runs on Linux — defensive).

**Returns**: `{ files, patternMap }` — `files` is an array of relative paths (POSIX-style, e.g. `"Recipes/Italian/Pasta.md"`). `patternMap` maps each file to its first matching pattern (used by staging for prefix stripping).

#### `tagFilter`

For each file in the input list:
1. Read file content as UTF-8.
2. Test against regex: `` new RegExp(`(?:^|\\s)#${escapedTag}(?:\\s|$)`, 'm') ``
   - `escapedTag` = tag string with regex special chars escaped.
   - Matches `#publish` at start of line, after whitespace, or before whitespace/end of line.
   - Does **not** match inside words (e.g. `something#publish` is not a match).
   - Does **not** match inside YAML frontmatter — but since frontmatter also contains no `#` prefix tags in standard format, this is acceptable. The `tags: [publish]` frontmatter style is intentionally not recognized.
3. Does **not** match inside fenced code blocks. Implementation: strip fenced code blocks (`` ```...``` ``) before testing. Simple regex: `` /^```[\s\S]*?^```/gm ``.

**Returns**: Filtered array of relative paths that contain the inline tag.

**Edge cases**:
- `#publish` inside a markdown heading like `## #publish` — this is a valid match (user intentionally tagged the heading).
- `#publish` inside inline code `` `#publish` `` — should NOT match. Strip inline code spans before testing: `` /`[^`]+`/g ``.
- `#publish` inside a link `[#publish](url)` — this IS a match (it's inline text).
- Empty file — no match.
- Binary file matched by glob (unlikely but possible) — read as UTF-8, regex won't match, file is excluded.

---

### 4.3 `src/assets.js` — Image Reference Extraction

**Exports**: `extractImages(vaultRoot: string, files: string[], deps?): Promise<ImageRef[]>`

`deps` defaults to `{ core: await import("@actions/core") }`. Tests inject a mock `core` to capture warnings.

**ImageRef type**:
```ts
interface ImageRef {
  sourcePath: string;   // absolute path to image file
  outputPath: string;   // relative path for output directory
}
```

**Behavior**:

For each file, scan content for:

1. **Standard markdown images**: `![alt](path)` — regex: `/!\[([^\]]*)\]\(([^)]+)\)/g` — capture group 2 is the path.
2. **Obsidian embeds**: `![[image.ext]]` — regex: `/!\[\[([^\]|]+(?:\.(png|jpg|jpeg|gif|svg|webp|avif|bmp|ico)))\]\]/gi` — capture group 1 is the filename.

**Path resolution order** (for each reference):
1. Relative to the referring file's directory.
2. Relative to the vault root.
3. If neither resolves to an existing file → log a warning via `core.warning()`, skip (do not fail the build).

**Deduplication**: Collect all resolved absolute paths into a `Set`. Return unique `ImageRef` entries.

**Output path**: Preserve the path relative to vault root. E.g. vault file `Recipes/images/pasta.jpg` → output `images/pasta.jpg` (relative to output root).

**Edge cases**:
- External URLs (`https://...`) in image src → skip (not a local asset).
- Query strings or anchors in path (`image.png?size=100`) → strip before resolving.
- Spaces in filenames → handle as-is (Obsidian supports them).
- Image referenced by multiple files → deduplicated.
- Non-image `![[embed]]` (e.g. `![[note.md]]`) → filtered out by extension check.

---

### 4.4 `src/staging.js` — Stage Filtered Files

**Exports**: `stageFiles(opts: StageOptions): Promise<StagedFile[]>`

```ts
interface StageOptions {
  vaultRoot: string;
  files: string[];        // relative paths from filter
  images: ImageRef[];
  patternMap: Map<string, string>;  // file → first matching pattern (from globFilter)
}

interface StagedFile {
  inputPath: string;      // absolute source path
  stagedPath: string;     // absolute path in staging dir
  outputRelative: string; // clean relative path (glob prefix stripped)
}
```

**Behavior**:

1. Create `stagingDir` (use `fs.mkdtemp` in `os.tmpdir()`).
2. For each published file:
   a. Look up the file's matching pattern from `patternMap`.
   b. Strip the **static prefix** of that pattern to produce a clean path.
      - Pattern `Recipes/**` has prefix `Recipes/` → `Recipes/Italian/Pasta.md` → `Italian/Pasta.md`.
      - Pattern `**` has no prefix → path unchanged.
      - Pattern `Tech/Guides/**` has prefix `Tech/Guides/` → `Tech/Guides/Git.md` → `Git.md`.
      - **Static prefix** = everything before the first glob character (`*`, `?`, `{`, `[`).
   c. Copy file to `stagingDir/<cleanPath>`.
3. For each image: copy to `stagingDir/<outputPath>`.
4. Return `{ stagingDir, stagedFiles }`.

**Edge cases**:
- Prefix stripping yields empty string (file is at the glob prefix itself) → use filename only.
- Deeply nested directories → create parent dirs with `{ recursive: true }`.

---

### 4.5 `src/wikilinks.js` — Remark Plugin

**Exports**: `remarkWikiLinks(options: WikiLinkOptions)` — returns a remark plugin function.

```ts
interface WikiLinkOptions {
  publishedFiles: Map<string, string>;  // filename/title → output URL
  basePath: string;
}
```

**Behavior**:

The plugin is a function that receives the mdast tree and transforms it in place.

1. **Build lookup map** (done by caller, passed in):
   - Key: lowercased filename without extension (e.g. `pasta` for `Pasta.md`)
   - Key: lowercased first `# heading` text
   - Value: the full output URL including `basePath`

2. **Visit `text` nodes** using `unist-util-visit`:
   - Find `[[...]]` patterns in text content.
   - Parse each match: `[[target]]` or `[[target|display]]`.
   - Look up `target` (case-insensitive) in the published map.
   - **Published target**: replace with an `html` node containing `<a href="${url}">${display}</a>` — or splice in a `link` node in the mdast if preferred. Using an `html` raw node is simpler and avoids mdast typing complexity.
   - **Unpublished target**: replace with an `html` node containing `<span class="dead-link">${display}</span>`.
   - `display` defaults to `target` if no alias provided.

3. **Node splitting**: A text node like `"see [[Pasta]] for details"` must be split into three nodes: text `"see "`, the replacement html node, and text `" for details"`. Replace the original text node in `parent.children`.

**Automatically safe**: The `visit` function only visits `text` nodes — it never enters `code`, `inlineCode`, or `html` nodes. Wiki-links inside fenced code blocks or inline code are untouched.

**Edge cases**:
- `[[Target]]` where Target has spaces → lookup key is `target` (lowercase, spaces preserved).
- `[[Pasta|My Favorite Pasta]]` → display = `My Favorite Pasta`, lookup key = `pasta`.
- `[[multiple]] [[links]]` in one text node → handle all matches in that node.
- `[[nested [[brackets]]]]` → not valid Obsidian syntax, treated as literal text.
- Empty `[[]]` → skip, leave as literal text.
- `\[\[escaped\]\]` → remark-parse doesn't produce escape sequences in text nodes this way; not a concern.

---

### 4.6 `src/render.js` — Unified Pipeline

**Exports**:
- `createProcessor(wikiLinkOptions: WikiLinkOptions): Processor`
- `renderFile(processor: Processor, content: string): Promise<{ html: string, title: string }>`

**`createProcessor`**:
```js
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { remarkWikiLinks } from "./wikilinks.js";

export function createProcessor(wikiLinkOptions) {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkWikiLinks, wikiLinkOptions)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });
}
```

Note: `allowDangerousHtml: true` is required because the wiki-link plugin injects raw HTML nodes (`<a>`, `<span>`). This is safe because the action controls all injected HTML — no user-supplied raw HTML passes through this flag.

**`renderFile`**:
1. Parse and process the markdown string through the pipeline.
2. During processing, visit the mdast to extract the title:
   - Find first node with `type: "heading"` and `depth: 1`.
   - Extract its text content (concatenate all child text nodes).
   - If no H1 found, return `null` (caller uses filename fallback).
3. Return `{ html: String(result), title }`.

**Title extraction detail**: Use a small remark plugin (inline or separate) that runs before remark-rehype. It visits the tree once, grabs the first H1 text, stores it. This avoids parsing the HTML output.

---

### 4.7 `src/templates.js` — Built-in Layouts

**Exports**:
- `renderPage(data: PageData): string`
- `renderIndex(data: IndexData): string`
- `defaultStylesheet(): string`

```ts
interface PageData {
  title: string;
  content: string;        // rendered HTML
  basePath: string;
  siteTitle: string;
}

interface IndexData {
  title: string;           // site title
  pages: PageEntry[];
  basePath: string;
}

interface PageEntry {
  title: string;
  url: string;             // relative URL
  folder: string;          // grouping folder, e.g. "Italian"
}
```

**`renderPage`**: Returns a complete HTML document via template literal:
- `<html lang="en">` with `<meta charset="utf-8">`, `<meta name="viewport">`.
- `<title>` from page title + site title.
- `<link>` to `style.css` (via `basePath`).
- `<nav>` with link back to index (`basePath + "/"`).
- `<article>` wrapping the content HTML.

**`renderIndex`**: Returns a complete HTML document:
- Same boilerplate head.
- `<h1>` with site title.
- Pages grouped by `folder`, each group as a `<section>` with `<h2>` folder name.
- Each page as a list item with link.
- Pages with empty folder go under a "Root" or ungrouped section.

**`defaultStylesheet`**: Returns CSS string:
- System-preference dark/light via `prefers-color-scheme`.
- Responsive layout (max-width content area, readable line length).
- `.dead-link` styling: grey text, no underline, slightly dimmed.
- Basic typography: system font stack, heading sizes, paragraph spacing.
- Nav styling.

---

### 4.8 Template Override System

**Location**: `_templates/` directory in vault root.

**Detection**: Check for existence of `_templates/page.html` in vault root.

**Mode**: All-or-nothing. If `_templates/page.html` exists, the override system activates. Expected files:

| File | Required | Fallback |
|---|---|---|
| `_templates/page.html` | yes (trigger) | — |
| `_templates/index.html` | no | built-in `renderIndex` |
| `_templates/style.css` | no | built-in `defaultStylesheet` |

**Placeholder syntax** — simple `{{key}}` replacement via `String.replace()`:

| Placeholder | Available in | Value |
|---|---|---|
| `{{content}}` | page.html | Rendered HTML of the markdown file |
| `{{title}}` | page.html, index.html | Page title or site title |
| `{{basePath}}` | page.html, index.html | URL prefix |
| `{{siteTitle}}` | page.html | Site title from config |
| `{{pages}}` | index.html | Pre-rendered HTML list of pages (same markup as built-in index) |

**Implementation**: Read template file, do `template.replaceAll("{{content}}", data.content)` for each placeholder. No nested templates, no conditionals, no loops — just flat substitution.

**Security note**: `{{content}}` contains rendered markdown HTML. Since the input is the user's own vault files, XSS is not a concern (the user controls both input and output). The placeholder replacement does not execute code.

---

### 4.9 `src/build.js` — Build Orchestration

**Exports**: `build(opts: BuildOptions, deps?): Promise<void>`

`deps` defaults to `{ core: await import("@actions/core") }`. Tests inject a mock `core` to capture `info`/`warning` calls.

```ts
interface BuildOptions {
  config: Config;
  stagedFiles: StagedFile[];
  images: ImageRef[];
  stagingDir: string;
  outputDir: string;
  vaultRoot: string;
}
```

**Behavior**:

1. **Build wiki-link lookup map**:
   - For each staged file, quick-extract the title (read first `# heading` line via regex — faster than full parse for map building).
   - Map: lowercase filename (no ext) → URL, lowercase title → URL.
   - URL = `basePath + "/" + outputRelative` with `.md` replaced by `/` (directory-style URLs) or `.html`.
   - **Decision**: Use `/path/index.html` output (write `Italian/Pasta/index.html`) so URLs are clean (`/Italian/Pasta/`).

2. **Create remark processor** with wiki-link options.

3. **Resolve templates**: Check for `_templates/` override (§4.8). Load override files or use built-in functions.

4. **Process each staged markdown file**:
   a. Read content from staging dir.
   b. `renderFile(processor, content)` → `{ html, title }`.
   c. Title fallback: if `title` is null, use filename without extension.
   d. Render page layout → full HTML document.
   e. Write to `outputDir/<outputRelative>/index.html` (creating dirs as needed).
   f. Collect `{ title, url, folder }` for index.

5. **Generate index page**:
   - Group collected pages by folder (first path segment of `outputRelative`).
   - Render index layout.
   - Write to `outputDir/index.html`.

6. **Copy images**: For each image ref, copy from vault to `outputDir/<outputPath>`.

7. **Write stylesheet**: Write CSS to `outputDir/style.css` (built-in or override).

8. **Summary**: Log via `core.info()`: number of pages published, number of images copied.

---

### 4.10 `src/main.js` — Orchestrator

```js
import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseConfig } from "./config.js";
import { globFilter, tagFilter } from "./filter.js";
import { extractImages } from "./assets.js";
import { stageFiles } from "./staging.js";
import { build } from "./build.js";

export async function run(deps = { core, github }) {
  try {
    const vaultRoot = deps.core.getInput("markdown-location") || ".";
    const outputDir = deps.core.getInput("site-location") || "_site";

    const config = await parseConfig(vaultRoot, { github: deps.github });

    const { files: globbed, patternMap } = await globFilter(vaultRoot, config.include);
    deps.core.info(`Glob matched ${globbed.length} files`);

    const published = await tagFilter(vaultRoot, globbed, config.tag);
    deps.core.info(`Tag filter: ${published.length} files have #${config.tag}`);

    if (published.length === 0) {
      deps.core.warning("No files matched both glob and tag filters. Site will be empty.");
    }

    const images = await extractImages(vaultRoot, published);
    deps.core.info(`Found ${images.length} image references`);

    const { stagingDir, stagedFiles } = await stageFiles({
      vaultRoot, files: published, images,
      patternMap,
    });

    await build({
      config, stagedFiles, images,
      stagingDir, outputDir, vaultRoot,
    });

    deps.core.info(`Site generated at ${outputDir}`);
  } catch (error) {
    deps.core.setFailed(error.message);
  }
}
```

---

## 5. URL Structure

### 5.1 Glob Prefix Stripping

Given pattern `Recipes/**` and file `Recipes/Italian/Pasta.md`:
- Static prefix of `Recipes/**` is `Recipes/`.
- Strip prefix: `Italian/Pasta.md`.
- Output: `<outputDir>/Italian/Pasta/index.html`.
- URL: `<basePath>/Italian/Pasta/`.

Given pattern `**` and file `Notes/Todo.md`:
- Static prefix of `**` is empty.
- Output: `<outputDir>/Notes/Todo/index.html`.
- URL: `<basePath>/Notes/Todo/`.

### 5.2 Output Directory Layout

```
_site/
├── index.html              ← index page
├── style.css               ← stylesheet
├── Italian/
│   └── Pasta/
│       └── index.html      ← Recipes/Italian/Pasta.md
├── Basics/
│   └── Bread/
│       └── index.html      ← Recipes/Basics/Bread.md
└── images/
    └── pasta.jpg            ← referenced image
```

---

## 6. File Map

| File | Purpose |
|---|---|
| `index.js` | Entry point — imports and calls `run()` |
| `src/main.js` | Orchestrator — wires all modules together |
| `src/config.js` | Parse and validate `.md-ssg.yml` |
| `src/filter.js` | Glob matching + inline tag detection |
| `src/assets.js` | Image reference extraction from markdown |
| `src/staging.js` | Copy files to temp dir with path rewriting |
| `src/wikilinks.js` | Remark plugin for `[[wiki-link]]` resolution |
| `src/render.js` | Unified remark/rehype processor + title extraction |
| `src/build.js` | Build loop: render, template, write, index, copy assets |
| `src/templates.js` | Built-in page + index layouts (template literals) + default CSS |
| `action.yml` | GitHub Action metadata |

---

## 7. Dependencies

### Runtime

| Package | Purpose |
|---|---|
| `unified` | Pipeline framework |
| `remark-parse` | Markdown → mdast |
| `remark-frontmatter` | Strip YAML frontmatter from AST |
| `remark-rehype` | mdast → hast bridge |
| `rehype-stringify` | hast → HTML string |
| `unist-util-visit` | AST tree walker (used by wiki-link plugin) |
| `js-yaml` | Parse `.md-ssg.yml` |
| `@actions/core` | GitHub Action logging, inputs, setFailed |
| `@actions/github` | GitHub context (repo name for defaults) |

### Dev

| Package | Purpose |
|---|---|
| `@vercel/ncc` | Bundle all code + deps into `dist/index.js` |

Tests use Node.js built-in `node:test` runner — no test framework dependency.

### Not Used (and why)

| Rejected | Reason |
|---|---|
| `@11ty/eleventy` | Full framework unnecessary; remark/rehype gives total pipeline control |
| `gray-matter` | No frontmatter value parsing needed; `remark-frontmatter` handles stripping |
| `markdown-it` | Replaced by remark-parse + remark-rehype (AST-based) |
| `fast-glob` / `fdir` / `picomatch` | `fs.glob()` built-in since Node 22; zero dependencies needed |
| `nunjucks` / `eta` | Template literals sufficient for two layouts; overrides use string replacement |

---

## 8. Error Handling Strategy

### 8.1 Fail-fast Errors

These abort the entire action via `core.setFailed()`:

| Error | Source |
|---|---|
| `.md-ssg.yml` not found | `config.js` |
| Invalid YAML in config | `config.js` |
| `include` missing or empty | `config.js` |
| Invalid `tag` or `base-path` format | `config.js` |
| File system permission errors | Any module |
| Remark pipeline crash | `render.js` |

### 8.2 Warnings (non-fatal)

These log via `core.warning()` and continue:

| Warning | Source |
|---|---|
| Zero files match after both filters | `main.js` |
| Image reference can't be resolved | `assets.js` |
| Markdown file fails to render | `build.js` (skip file, continue with others) |

### 8.3 Info Logging

Each phase logs progress via `core.info()`:
- Number of glob-matched files
- Number of tag-filtered files
- Number of images found
- Number of pages written
- Final output path

---

## 9. Testing Plan

### 9.1 Test Framework

`node:test` — Node.js built-in test runner (Node 20+). Zero dependencies. Uses `node:assert/strict` for assertions.

**Mocking strategy**: Dependency injection. Modules that depend on `@actions/core` or `@actions/github` accept an optional `deps` parameter with defaults to the real imports. Tests pass lightweight mock objects instead. No module-level mocking needed.

```js
// Production: uses real @actions/core
await parseConfig(vaultRoot);

// Test: injects mock
await parseConfig(vaultRoot, { github: { context: { repo: { repo: "test-repo" } } } });
```

### 9.2 Unit Tests

#### `config.test.js`
| Test case | Input | Expected |
|---|---|---|
| Valid minimal config | `include: ["**"]` | Returns config with defaults |
| Valid full config | All fields set | Returns config with provided values |
| Missing `include` | `tag: "publish"` | Throws with descriptive message |
| Empty `include` array | `include: []` | Throws |
| `include` not array | `include: "**"` | Throws |
| Invalid `tag` chars | `tag: "pub lish"` | Throws |
| Invalid `base-path` | `base-path: "no-slash"` | Throws |
| Empty file | `""` | Throws with missing include error |
| Missing file | Non-existent path | Throws with file not found |

#### `filter.test.js`
| Test case | Expected |
|---|---|
| Files inside glob pattern | Included |
| Files outside glob pattern | Excluded |
| Non-`.md` files inside pattern | Excluded |
| Multiple overlapping patterns | File included (not duplicated) |
| File with `#publish` in body text | Passes tag filter |
| File with `#publish` at start of line | Passes |
| File without `#publish` | Rejected |
| `#publish` inside fenced code block | Rejected |
| `#publish` inside inline code | Rejected |
| `#publish` inside heading `## #publish` | Passes |
| Custom tag name | Matches `#<custom>` |
| File with tag but outside glob | Rejected (AND logic) |

#### `wikilinks.test.js`
| Test case | Input | Expected |
|---|---|---|
| Published link | `[[Pasta]]` | `<a href="/base/Italian/Pasta/">Pasta</a>` |
| Unpublished link | `[[Secret]]` | `<span class="dead-link">Secret</span>` |
| Alias syntax | `[[Pasta\|Great Pasta]]` | `<a href="...">Great Pasta</a>` |
| Multiple links in one line | `see [[A]] and [[B]]` | Both resolved |
| Link inside code block | `` ```\n[[Pasta]]\n``` `` | Untouched |
| Link inside inline code | `` `[[Pasta]]` `` | Untouched |
| Case-insensitive lookup | `[[pasta]]` matches `Pasta.md` | Resolved |
| Empty brackets | `[[]]` | Untouched |
| Link with spaces | `[[My Pasta Recipe]]` | Resolved if published |

#### `assets.test.js`
| Test case | Input | Expected |
|---|---|---|
| Standard image | `![alt](img.png)` | `img.png` extracted |
| Obsidian embed | `![[photo.jpg]]` | `photo.jpg` extracted |
| Relative path | `![](../images/a.png)` | Resolved relative to file |
| External URL | `![](https://example.com/a.png)` | Skipped |
| Non-image embed | `![[note.md]]` | Skipped |
| Duplicate references | Same image in two files | Deduplicated |
| Missing image file | Path doesn't exist | Warning logged, skipped |

#### `render.test.js`
| Test case | Expected |
|---|---|
| Basic markdown | Correct HTML output |
| Frontmatter present | YAML block not in HTML output |
| H1 title extraction | Returns title string |
| No H1 in file | Title is `null` |
| Wiki-links processed | Links/spans in output |

#### `templates.test.js`
| Test case | Expected |
|---|---|
| `renderPage` output | Valid HTML with title, content, nav |
| `renderIndex` with grouped pages | Sections per folder with links |
| `renderIndex` with empty pages | Valid HTML, no crash |
| Default stylesheet | Contains `prefers-color-scheme`, `.dead-link` |

### 9.3 Integration Test

**Setup**: Create a mock vault in a temp directory:
```
vault/
├── .md-ssg.yml           # include: ["Notes/**"], tag: "publish"
├── Notes/
│   ├── Published.md      # has #publish, links to Other, has image
│   ├── Other.md          # has #publish, linked from Published
│   ├── Secret.md         # no #publish tag
│   └── images/
│       └── diagram.png
├── Private/
│   └── Journal.md        # has #publish but outside glob
└── _templates/            # (optional: test override path too)
```

**Assertions**:
- `_site/Published/index.html` exists, contains rendered content.
- `_site/Other/index.html` exists.
- `_site/Secret/` does **not** exist (no tag).
- `_site/Journal/` does **not** exist (outside glob, despite having tag).
- `_site/index.html` exists, lists Published and Other.
- `_site/style.css` exists.
- `_site/images/diagram.png` exists.
- Wiki-link from Published → Other is a working `<a>` link.
- Wiki-link from Published → Secret is a `<span class="dead-link">`.
- No YAML frontmatter visible in HTML output.

### 9.4 Manual Testing

1. `npx @github/local-action run . main.js .env` — local action runner.
2. Push to test repo, trigger workflow, verify Pages deployment.
3. Mobile check: responsive layout, dark/light mode.

---

## 10. Build & Distribution

### 10.1 Bundle

```json
{
  "scripts": {
    "build": "ncc build index.js -o dist",
    "test": "node --test"
  }
}
```

`ncc` bundles `index.js` and all dependencies into `dist/index.js`. This is what the action runs.

### 10.2 `action.yml` Entry Point

```yaml
runs:
  using: node24
  main: dist/index.js
```

### 10.3 Git

`dist/` is committed to the repo (standard practice for JS GitHub Actions). Add a build step to CI that verifies `dist/` is up to date.

---

## 11. Example Workflow

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]

permissions:
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: olavvatne/md-ssg-action@v1
        with:
          markdown-location: "."
          site-location: "_site"

      - uses: actions/upload-pages-artifact@v3
        with:
          path: "_site"

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deploy.outputs.page_url }}
    steps:
      - id: deploy
        uses: actions/deploy-pages@v4
```

---

## 12. Decisions Log

| # | Decision | Rationale |
|---|---|---|
| 1 | **AND logic**: glob + tag | Two independent layers of safety against accidental publishing |
| 2 | **Inline tag only** | `#publish` scanned with boundary matching; no frontmatter tag parsing needed |
| 3 | **remark/rehype pipeline** | AST-based transforms for wiki-links/images; skips code blocks by design; extensible |
| 4 | **No Eleventy** | Total control over pipeline; fewer deps; framework opinions not needed for this scope |
| 5 | **Template literals** | Two layouts don't justify a template engine; overrides use `{{placeholder}}` string replacement |
| 6 | **`fs.glob()`** | Zero-dep, built-in Node.js glob with directory pruning; no file crawler needed |
| 7 | **Titles from first `# heading`** | Filename fallback; no frontmatter parsing required |
| 8 | **`remark-frontmatter` for stripping** | Prevents YAML blocks rendering as `<hr>` + visible text; doesn't parse values |
| 9 | **Dead links as styled spans** | Unpublished targets visible but clearly non-functional; prevents broken `<a>` links |
| 10 | **Images auto-included** | Referenced by published files → copied to output; no manual asset management |
| 11 | **Glob prefix stripped for URLs** | Clean paths without vault structure leaking into URLs |
| 12 | **Template override: all-or-nothing** | Simple mental model; `_templates/page.html` triggers override mode |
| 13 | **Build only** | Deployment is a separate concern handled by standard GitHub Pages actions |
| 14 | **Directory-style URLs** | `Pasta/index.html` → `/Pasta/` — clean, no `.html` in URLs |
| 15 | **`node:test` + dependency injection** | Zero test-framework deps; DI for `@actions/core` and `@actions/github` avoids fragile module mocking |

---

## 13. Out of Scope (v1)

- Exclude patterns in config
- Static search / full-text search
- Dataview / Mermaid rendering
- Frontmatter tag detection (`tags: [publish]`)
- Incremental builds
- Multiple tag requirements (AND/OR tag logic)
- RSS feed generation
- Sitemap generation
- Custom per-page layouts
