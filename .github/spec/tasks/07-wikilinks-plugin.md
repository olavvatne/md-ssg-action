# Task 07 — Wiki-Links Remark Plugin

## Goal

Implement `src/wikilinks.js` — a remark plugin that resolves `[[wiki-links]]` to HTML links for published files and dead-link spans for unpublished targets.

## Scope

### `src/wikilinks.js`

**Export**: `remarkWikiLinks(options: WikiLinkOptions)` — returns a remark plugin function.

```ts
interface WikiLinkOptions {
  publishedFiles: Map<string, string>;  // filename/title → output URL
  basePath: string;
}
```

**Behavior**:

1. **Lookup map** (built by caller, passed in):
   - Key: lowercased filename without extension (e.g. `pasta` for `Pasta.md`)
   - Key: lowercased first `# heading` text
   - Value: the full output URL including `basePath`

2. **Visit `text` nodes** using `unist-util-visit`:
   - Find `[[...]]` patterns in text content.
   - Parse each match: `[[target]]` or `[[target|display]]`.
   - Look up `target` (case-insensitive) in the published map.
   - **Published target**: replace with `html` node: `<a href="${url}">${display}</a>`.
   - **Unpublished target**: replace with `html` node: `<span class="dead-link">${display}</span>`.
   - `display` defaults to `target` if no alias provided.

3. **Node splitting**: Text like `"see [[Pasta]] for details"` → split into: text `"see "`, html node, text `" for details"`. Replace original text node in `parent.children`.

**Automatically safe**: `visit` only hits `text` nodes — never enters `code`, `inlineCode`, or `html` nodes.

### Edge Cases

- `[[Target]]` with spaces → lookup key preserves spaces (lowercased).
- `[[Pasta|My Favorite Pasta]]` → display = `My Favorite Pasta`, lookup key = `pasta`.
- Multiple `[[links]]` in one text node → handle all matches.
- `[[nested [[brackets]]]]` → not valid, treated as literal text.
- Empty `[[]]` → skip, leave as literal text.

## Tests — `src/wikilinks.test.js`

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

## Acceptance Criteria

- [ ] Wiki-links in text nodes resolved to `<a>` or `<span>` HTML
- [ ] Alias syntax (`|display`) works
- [ ] Case-insensitive lookup
- [ ] Links inside code blocks/inline code untouched
- [ ] Node splitting handles surrounding text correctly
- [ ] All unit tests pass

## Spec References

- §4.5 (wikilinks.js module spec)
