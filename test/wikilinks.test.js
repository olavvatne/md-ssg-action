import test from "node:test";
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { remarkWikiLinks } from "../src/wikilinks.js";

async function render(markdown, publishedFiles) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkWikiLinks, { publishedFiles, basePath: "/base" })
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });

  const result = await processor.process(markdown);
  return String(result);
}

test("remarkWikiLinks renders published links as anchors", async () => {
  const html = await render("[[Pasta]]", new Map([["pasta", "/base/Italian/Pasta/"]]));
  assert.match(html, /<a href="\/base\/Italian\/Pasta\/">Pasta<\/a>/);
});

test("remarkWikiLinks renders unpublished links as dead-link spans", async () => {
  const html = await render("[[Secret]]", new Map());
  assert.match(html, /<span class="dead-link">Secret<\/span>/);
});

test("remarkWikiLinks supports alias syntax", async () => {
  const html = await render("[[Pasta|Great Pasta]]", new Map([["pasta", "/base/Italian/Pasta/"]]));
  assert.match(html, /<a href="\/base\/Italian\/Pasta\/">Great Pasta<\/a>/);
});

test("remarkWikiLinks resolves multiple links in one line", async () => {
  const html = await render(
    "see [[A]] and [[B]]",
    new Map([
      ["a", "/base/A/"],
      ["b", "/base/B/"],
    ]),
  );

  assert.match(html, /see <a href="\/base\/A\/">A<\/a> and <a href="\/base\/B\/">B<\/a>/);
});

test("remarkWikiLinks does not touch links inside fenced code blocks", async () => {
  const html = await render("```\n[[Pasta]]\n```", new Map([["pasta", "/base/Pasta/"]]));
  assert.match(html, /<pre><code>\[\[Pasta\]\]\n<\/code><\/pre>/);
  assert.doesNotMatch(html, /<a href=/);
});

test("remarkWikiLinks does not touch links inside inline code", async () => {
  const html = await render("`[[Pasta]]`", new Map([["pasta", "/base/Pasta/"]]));
  assert.match(html, /<code>\[\[Pasta\]\]<\/code>/);
  assert.doesNotMatch(html, /<a href=/);
});

test("remarkWikiLinks resolves links case-insensitively", async () => {
  const html = await render("[[pasta]]", new Map([["pasta", "/base/Italian/Pasta/"]]));
  assert.match(html, /<a href="\/base\/Italian\/Pasta\/">pasta<\/a>/);
});

test("remarkWikiLinks leaves empty brackets untouched", async () => {
  const html = await render("[[]]", new Map());
  assert.match(html, /<p>\[\[\]\]<\/p>/);
});

test("remarkWikiLinks resolves links with spaces", async () => {
  const html = await render(
    "[[My Pasta Recipe]]",
    new Map([["my pasta recipe", "/base/Recipes/My-Pasta-Recipe/"]]),
  );

  assert.match(html, /<a href="\/base\/Recipes\/My-Pasta-Recipe\/">My Pasta Recipe<\/a>/);
});
