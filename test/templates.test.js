import test from "node:test";
import assert from "node:assert/strict";
import { defaultStylesheet, renderIndex, renderPage } from "../src/templates.js";

test("renderPage returns complete HTML with title, nav, content, and stylesheet", () => {
  const html = renderPage({
    title: "Pasta",
    content: "<h1>Pasta</h1><p>Great.</p>",
    basePath: "/base",
    siteTitle: "My Site",
  });

  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<title>Pasta - My Site<\/title>/);
  assert.match(html, /<link rel="stylesheet" href="\/base\/style\.css">/);
  assert.match(html, /<nav><a href="\/base\/?">Home<\/a><\/nav>/);
  assert.match(html, /<article>[\s\S]*<h1>Pasta<\/h1><p>Great\.<\/p>[\s\S]*<\/article>/);
});

test("renderIndex groups pages by folder", () => {
  const html = renderIndex({
    title: "Recipes",
    basePath: "/recipes",
    pages: [
      { title: "Carbonara", url: "/recipes/Italian/Carbonara/", folder: "Italian" },
      { title: "Ramen", url: "/recipes/Asian/Ramen/", folder: "Asian" },
      { title: "Lasagna", url: "/recipes/Italian/Lasagna/", folder: "Italian" },
    ],
  });

  assert.match(html, /<h2>Italian<\/h2>/);
  assert.match(html, /<h2>Asian<\/h2>/);
  assert.match(html, /Carbonara/);
  assert.match(html, /Lasagna/);
  assert.match(html, /Ramen/);
});

test("renderIndex handles empty pages without crashing", () => {
  const html = renderIndex({
    title: "Empty",
    basePath: "/base",
    pages: [],
  });

  assert.match(html, /<title>Empty<\/title>/);
  assert.match(html, /No pages published\./);
});

test("renderIndex lists ungrouped pages", () => {
  const html = renderIndex({
    title: "Mixed",
    basePath: "/base",
    pages: [{ title: "Root Note", url: "/base/Root-Note/", folder: "" }],
  });

  assert.match(html, /<h2>Pages<\/h2>/);
  assert.match(html, /Root Note/);
});

test("defaultStylesheet includes dark mode, dead-link style, and responsive rule", () => {
  const css = defaultStylesheet();

  assert.match(css, /prefers-color-scheme: dark/);
  assert.match(css, /\.dead-link\s*\{/);
  assert.match(css, /@media \(max-width: 720px\)/);
});

test("basePath is applied to internal links", () => {
  const pageHtml = renderPage({
    title: "Page",
    content: "<p>Text</p>",
    basePath: "/docs",
    siteTitle: "Site",
  });

  const indexHtml = renderIndex({
    title: "Docs",
    basePath: "/docs",
    pages: [{ title: "One", url: "/docs/one/", folder: "" }],
  });

  assert.match(pageHtml, /href="\/docs\/style\.css"/);
  assert.match(pageHtml, /href="\/docs\/?"/);
  assert.match(indexHtml, /href="\/docs\/style\.css"/);
});
