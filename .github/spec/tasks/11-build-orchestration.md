# Task 11 — Build Orchestration

## Goal

Implement `src/build.js` — the build loop that ties rendering, templating, image copying, and output writing together.

## Scope

### `src/build.js`

**Export**: `build(opts: BuildOptions, deps?): Promise<void>`

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
   - For each staged file, quick-extract the title (regex on first `# heading` line).
   - Map: lowercase filename (no ext) → URL, lowercase title → URL.
   - URL = `basePath + "/" + outputRelative` with `.md` replaced, using directory-style URLs.
   - Output pattern: `/path/index.html` → clean URL `/path/`.

2. **Create remark processor** with wiki-link options.

3. **Resolve templates**: Check for `_templates/` override (Task 10). Load overrides or use built-in functions.

4. **Process each staged markdown file**:
   a. Read content from staging dir.
   b. `renderFile(processor, content)` → `{ html, title }`.
   c. Title fallback: if `title` is null, use filename without extension.
   d. Render page layout → full HTML document.
   e. Write to `outputDir/<outputRelative>/index.html` (creating dirs as needed).
   f. Collect `{ title, url, folder }` for index.

5. **Generate index page**:
   - Group pages by folder (first path segment of `outputRelative`).
   - Render index layout.
   - Write to `outputDir/index.html`.

6. **Copy images**: For each image ref, copy from vault to `outputDir/<outputPath>`.

7. **Write stylesheet**: Write CSS to `outputDir/style.css`.

8. **Summary**: Log via `core.info()`: number of pages published, number of images copied.

### URL Structure

- `Recipes/Italian/Pasta.md` (after prefix strip: `Italian/Pasta.md`) → `outputDir/Italian/Pasta/index.html` → URL: `/basePath/Italian/Pasta/`
- Folder grouping for index: `Italian` (first path segment).

### Error Handling

- Individual file render failures → `core.warning()`, skip file, continue.
- Image copy failures → warning, continue.
- Structural errors (can't create output dir) → throw (main.js catches and calls `setFailed`).

## Tests — `src/build.test.js`

| Test case | Expected |
|---|---|
| Single file build | `index.html` created in output subdir |
| Multiple files | All pages rendered, index lists them |
| Title extraction for URL map | Wiki-link map correctly built |
| Filename fallback for title | Used when no H1 present |
| Images copied to output | Image files in correct output path |
| Stylesheet written | `style.css` present in output root |
| Index page generated | Groups pages by folder |
| File render failure | Warning logged, other files still built |

## Acceptance Criteria

- [ ] Wiki-link lookup map correctly built from staged files
- [ ] All staged files rendered to HTML with page layout
- [ ] Directory-style URLs (`/path/index.html`)
- [ ] Index page generated with folder grouping
- [ ] Images copied to output directory
- [ ] Stylesheet written to output root
- [ ] Render failures handled gracefully (warning + continue)
- [ ] All unit tests pass

## Spec References

- §4.9 (build.js module spec)
- §5 (URL Structure)
- §5.2 (Output Directory Layout)
