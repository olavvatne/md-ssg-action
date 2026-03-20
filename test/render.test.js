import test from "node:test";
import assert from "node:assert/strict";
import { createProcessor, renderFile } from "../src/render.js";

function buildProcessor(publishedFiles = new Map()) {
  return createProcessor({ publishedFiles, basePath: "/base" });
}

test("renderFile converts basic markdown to HTML", async () => {
  const processor = buildProcessor();
  const { html } = await renderFile(processor, "# Title\n\nHello **world**\n");

  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<p>Hello <strong>world<\/strong><\/p>/);
});

test("renderFile removes YAML frontmatter from output", async () => {
  const processor = buildProcessor();
  const { html } = await renderFile(processor, "---\ntitle: hidden\n---\n\n# Visible\n");

  assert.doesNotMatch(html, /title: hidden/);
  assert.match(html, /<h1>Visible<\/h1>/);
});

test("renderFile extracts title from first H1", async () => {
  const processor = buildProcessor();
  const { title } = await renderFile(processor, "# First\n\n## Second\n");

  assert.equal(title, "First");
});

test("renderFile returns null title when no H1 exists", async () => {
  const processor = buildProcessor();
  const { title } = await renderFile(processor, "## Section\n\nBody\n");

  assert.equal(title, null);
});

test("renderFile processes wiki-links in output", async () => {
  const processor = buildProcessor(new Map([["pasta", "/base/italian/pasta/"]]));
  const { html } = await renderFile(processor, "See [[Pasta]] and [[Missing]].\n");

  assert.match(html, /<a href="\/base\/italian\/pasta\/">Pasta<\/a>/);
  assert.match(html, /<span class="dead-link">Missing<\/span>/);
});

test("renderFile uses only the first H1 for title", async () => {
  const processor = buildProcessor();
  const { title } = await renderFile(processor, "# One\n\n# Two\n");

  assert.equal(title, "One");
});

test("renderFile extracts H1 title text without inline markup", async () => {
  const processor = buildProcessor();
  const { title } = await renderFile(processor, "# Hello *nice* **world**\n");

  assert.equal(title, "Hello nice world");
});
