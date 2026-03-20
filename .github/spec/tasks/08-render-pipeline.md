# Task 08 — Render Pipeline

## Goal

Implement `src/render.js` — the unified remark/rehype processor that converts markdown to HTML with title extraction.

## Scope

### `src/render.js`

**Exports**:
- `createProcessor(wikiLinkOptions: WikiLinkOptions): Processor`
- `renderFile(processor: Processor, content: string): Promise<{ html: string, title: string | null }>`

**`createProcessor`**:
```js
unified()
  .use(remarkParse)
  .use(remarkFrontmatter, ["yaml"])
  .use(remarkWikiLinks, wikiLinkOptions)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeStringify, { allowDangerousHtml: true })
```

Note: `allowDangerousHtml: true` is required because the wiki-link plugin injects raw HTML nodes. This is safe because the action controls all injected HTML.

**`renderFile`**:
1. Parse and process the markdown string through the pipeline.
2. During processing, extract title via a small remark plugin that runs before remark-rehype:
   - Find first `heading` node with `depth: 1`.
   - Concatenate all child text nodes for the title.
   - If no H1 found, return `null` (caller uses filename fallback).
3. Return `{ html: String(result), title }`.

## Tests — `src/render.test.js`

| Test case | Expected |
|---|---|
| Basic markdown | Correct HTML output |
| Frontmatter present | YAML block not in HTML output |
| H1 title extraction | Returns title string |
| No H1 in file | Title is `null` |
| Wiki-links processed | Links/spans in output |
| Multiple headings | Only first H1 used for title |
| Inline formatting in H1 | Title text extracted without markup |

## Acceptance Criteria

- [ ] Remark/rehype pipeline produces correct HTML
- [ ] YAML frontmatter stripped from output
- [ ] Title extracted from first H1 heading
- [ ] Wiki-links integrated and working
- [ ] All unit tests pass

## Spec References

- §3.2 (Render Pipeline)
- §4.6 (render.js module spec)
