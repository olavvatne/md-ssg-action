# Task 04 — Tag Filtering

## Goal

Implement the `tagFilter` function in `src/filter.js` — scan file contents for the inline `#tag` and return only files that contain it.

## Scope

### `src/filter.js` (add `tagFilter`)

**Export**: `tagFilter(vaultRoot: string, files: string[], tag: string): Promise<string[]>`

**Behavior** for each file:
1. Read file content as UTF-8.
2. Strip fenced code blocks: `` /^```[\s\S]*?^```/gm ``
3. Strip inline code spans: `` /`[^`]+`/g ``
4. Test against regex: `` new RegExp(`(?:^|\\s)#${escapedTag}(?:\\s|$)`, 'm') ``
   - `escapedTag` = tag string with regex special chars escaped.
   - Matches `#tag` at start of line, after whitespace, or before whitespace/end of line.
   - Does **not** match inside words (e.g. `something#publish` is not a match).
5. Return filtered array of relative paths that contain the inline tag.

### Edge Cases

- `#publish` inside fenced code block → **not** a match.
- `#publish` inside inline code `` `#publish` `` → **not** a match.
- `#publish` inside heading `## #publish` → **is** a match.
- `#publish` inside link `[#publish](url)` → **is** a match.
- Empty file → no match.
- Custom tag name → matches `#<custom>`.

## Tests — `src/filter.test.js` (tag portion)

| Test case | Expected |
|---|---|
| File with `#publish` in body text | Passes tag filter |
| File with `#publish` at start of line | Passes |
| File without `#publish` | Rejected |
| `#publish` inside fenced code block | Rejected |
| `#publish` inside inline code | Rejected |
| `#publish` inside heading `## #publish` | Passes |
| Custom tag name | Matches `#<custom>` |
| `#publish` as part of another word | Rejected |
| Empty file | Rejected |

## Acceptance Criteria

- [ ] `tagFilter` correctly detects inline tags
- [ ] Tags inside code blocks and inline code are ignored
- [ ] Custom tag names supported
- [ ] All tag-related unit tests pass

## Spec References

- §4.2 (`tagFilter` spec)
