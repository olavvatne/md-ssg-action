# Task 06 — File Staging

## Goal

Implement `src/staging.js` — copy filtered files and images to a temporary staging directory with clean paths (glob prefix stripped).

## Scope

### `src/staging.js`

**Export**: `stageFiles(opts: StageOptions): Promise<{ stagingDir: string, stagedFiles: StagedFile[] }>`

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

1. Create staging dir via `fs.mkdtemp` in `os.tmpdir()`.
2. For each published file:
   a. Look up the file's matching pattern from `patternMap`.
   b. Strip the **static prefix** of that pattern.
      - Static prefix = everything before the first glob character (`*`, `?`, `{`, `[`).
      - Example: `Recipes/**` → prefix `Recipes/` → `Recipes/Italian/Pasta.md` → `Italian/Pasta.md`
      - Example: `**` → no prefix → path unchanged.
      - Example: `Tech/Guides/**` → prefix `Tech/Guides/` → `Tech/Guides/Git.md` → `Git.md`
   c. Copy file to `stagingDir/<cleanPath>`.
3. For each image: copy to `stagingDir/<outputPath>`.
4. Return `{ stagingDir, stagedFiles }`.

### Edge Cases

- File matches multiple patterns → use the first matching pattern for prefix stripping.
- Prefix stripping yields empty string → use filename only.
- Deeply nested directories → create parent dirs with `{ recursive: true }`.

## Tests — `src/staging.test.js`

| Test case | Expected |
|---|---|
| Simple prefix strip (`Recipes/**`) | `Recipes/Pasta.md` → `Pasta.md` |
| Deep prefix strip (`A/B/**`) | `A/B/C/D.md` → `C/D.md` |
| No prefix (`**`) | Path unchanged |
| File matches first of multiple patterns | First pattern's prefix used |
| Images copied to staging | Image present in staging dir |
| Nested directories created | Parent dirs exist |
| Prefix strip yields empty | Falls back to filename |

## Acceptance Criteria

- [ ] Staging directory created in temp location
- [ ] Glob prefix correctly stripped for all pattern types
- [ ] Files and images copied to staging directory
- [ ] `StagedFile` objects contain correct paths
- [ ] All unit tests pass

## Spec References

- §4.4 (staging.js module spec)
- §5.1 (Glob Prefix Stripping)
