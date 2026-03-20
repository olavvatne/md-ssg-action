# Task 03 — Glob Filtering

## Goal

Implement the `globFilter` function in `src/filter.js` — scan the vault directory and return `.md` files matching the configured glob patterns.

## Scope

### `src/filter.js` (partial — `globFilter` only)

**Export**: `globFilter(vaultRoot: string, patterns: string[]): Promise<{ files: string[], patternMap: Map<string, string> }>`

**Behavior**:
1. For each pattern, call `fs.glob(pattern, { cwd: vaultRoot })` — returns matching paths with directory pruning.
2. For each matched file, record which pattern first matched it in `patternMap` (Map<filePath, pattern>).
3. Collect results across all patterns into a `Set` (deduplication).
4. Filter to entries ending in `.md`.
5. Normalize path separators to `/` (Windows safety).

**Returns**: `{ files, patternMap }` — `files` is an array of relative paths. `patternMap` maps each file to its first matching pattern (used by staging for prefix stripping).

## Tests — `src/filter.test.js` (glob portion)

| Test case | Expected |
|---|---|
| Files inside glob pattern | Included |
| Files outside glob pattern | Excluded |
| Non-`.md` files inside pattern | Excluded |
| Multiple overlapping patterns | File included (not duplicated), patternMap records first match |
| Deeply nested files | Matched by `**` pattern |
| Pattern with specific folder prefix | Only files under that folder matched |
| Empty directory | Returns empty array |

## Acceptance Criteria

- [ ] `globFilter` correctly uses `fs.glob()` per pattern
- [ ] Only `.md` files returned
- [ ] Glob patterns applied correctly
- [ ] Path separators normalized to POSIX
- [ ] No duplicate entries when patterns overlap
- [ ] All glob-related unit tests pass

## Spec References

- §4.2 (`globFilter` spec)
