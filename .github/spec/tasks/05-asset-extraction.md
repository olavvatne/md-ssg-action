# Task 05 — Image/Asset Extraction

## Goal

Implement `src/assets.js` — scan published markdown files for image references and resolve them to file paths.

## Scope

### `src/assets.js`

**Export**: `extractImages(vaultRoot: string, files: string[], deps?): Promise<ImageRef[]>`

`deps` defaults to `{ core: await import("@actions/core") }`. Tests inject a mock `core` to capture warnings.

**ImageRef type**:
```ts
interface ImageRef {
  sourcePath: string;   // absolute path to image file
  outputPath: string;   // relative path for output directory
}
```

**Behavior** — for each file, scan content for:

1. **Standard markdown images**: `![alt](path)` — regex: `/!\[([^\]]*)\]\(([^)]+)\)/g` — capture group 2 is the path.
2. **Obsidian embeds**: `![[image.ext]]` — regex: `/!\[\[([^\]|]+(?:\.(png|jpg|jpeg|gif|svg|webp|avif|bmp|ico)))\]\]/gi` — capture group 1 is the filename.

**Path resolution order** (for each reference):
1. Relative to the referring file's directory.
2. Relative to the vault root.
3. If neither resolves → log warning via `core.warning()`, skip.

**Deduplication**: Collect all resolved absolute paths into a `Set`. Return unique `ImageRef` entries.

**Output path**: Preserve the path relative to vault root.

### Edge Cases

- External URLs (`https://...`) → skip.
- Query strings or anchors in path (`image.png?size=100`) → strip before resolving.
- Spaces in filenames → handle as-is.
- Image referenced by multiple files → deduplicated.
- Non-image `![[embed]]` (e.g. `![[note.md]]`) → filtered out by extension check.

## Tests — `src/assets.test.js`

| Test case | Input | Expected |
|---|---|---|
| Standard image | `![alt](img.png)` | `img.png` extracted |
| Obsidian embed | `![[photo.jpg]]` | `photo.jpg` extracted |
| Relative path | `![](../images/a.png)` | Resolved relative to file |
| External URL | `![](https://example.com/a.png)` | Skipped |
| Non-image embed | `![[note.md]]` | Skipped |
| Duplicate references | Same image in two files | Deduplicated |
| Missing image file | Path doesn't exist | Warning logged, skipped |
| Query string in path | `![](img.png?size=100)` | Stripped, resolved |

## Acceptance Criteria

- [ ] Both standard markdown and Obsidian embed syntaxes detected
- [ ] Path resolution tries file-relative then vault-relative
- [ ] External URLs skipped
- [ ] Deduplication works
- [ ] Missing images produce warnings, not errors
- [ ] All unit tests pass

## Spec References

- §4.3 (assets.js module spec)
