import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultStylesheet, renderIndex, renderPage, resolveTemplates } from "../src/templates.js";

async function withVault(setup, fn) {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "md-ssg-templates-"));

  try {
    await setup(vaultRoot);
    await fn(vaultRoot);
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
}

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

test("resolveTemplates uses built-in templates when no _templates/page.html exists", async () => {
  await withVault(
    async () => {},
    async (vaultRoot) => {
      const templates = await resolveTemplates(vaultRoot);
      const html = templates.renderPage({
        title: "One",
        content: "<p>Body</p>",
        basePath: "/base",
        siteTitle: "Site",
      });

      assert.match(html, /<title>One - Site<\/title>/);
      assert.match(templates.stylesheet(), /prefers-color-scheme: dark/);
    },
  );
});

test("resolveTemplates activates override mode when _templates/page.html exists", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "_templates"), { recursive: true });
      await writeFile(
        path.join(vaultRoot, "_templates", "page.html"),
        "<main>{{title}}</main>",
        "utf8",
      );
    },
    async (vaultRoot) => {
      const templates = await resolveTemplates(vaultRoot);
      const html = templates.renderPage({
        title: "Override",
        content: "<p>x</p>",
        basePath: "/base",
        siteTitle: "Site",
      });

      assert.equal(html, "<main>Override</main>");
    },
  );
});

test("resolveTemplates replaces page placeholders", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "_templates"), { recursive: true });
      await writeFile(
        path.join(vaultRoot, "_templates", "page.html"),
        "{{title}}|{{siteTitle}}|{{basePath}}|{{content}}",
        "utf8",
      );
    },
    async (vaultRoot) => {
      const templates = await resolveTemplates(vaultRoot);
      const html = templates.renderPage({
        title: "Page",
        content: "<p>Body</p>",
        basePath: "/docs",
        siteTitle: "Site",
      });

      assert.equal(html, "Page|Site|/docs|<p>Body</p>");
    },
  );
});

test("resolveTemplates falls back to built-in index when _templates/index.html is missing", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "_templates"), { recursive: true });
      await writeFile(path.join(vaultRoot, "_templates", "page.html"), "{{content}}", "utf8");
    },
    async (vaultRoot) => {
      const templates = await resolveTemplates(vaultRoot);
      const html = templates.renderIndex({
        title: "Docs",
        basePath: "/docs",
        pages: [{ title: "One", url: "/docs/one/", folder: "" }],
      });

      assert.match(html, /<!doctype html>/i);
      assert.match(html, /<h1>Docs<\/h1>/);
      assert.match(html, /One/);
    },
  );
});

test("resolveTemplates falls back to built-in stylesheet when _templates/style.css is missing", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "_templates"), { recursive: true });
      await writeFile(path.join(vaultRoot, "_templates", "page.html"), "{{content}}", "utf8");
    },
    async (vaultRoot) => {
      const templates = await resolveTemplates(vaultRoot);
      assert.match(templates.stylesheet(), /\.dead-link\s*\{/);
    },
  );
});

test("resolveTemplates uses all custom templates when page, index, and style are present", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "_templates"), { recursive: true });
      await writeFile(
        path.join(vaultRoot, "_templates", "page.html"),
        "<article>{{title}} {{siteTitle}} {{basePath}} {{content}}</article>",
        "utf8",
      );
      await writeFile(
        path.join(vaultRoot, "_templates", "index.html"),
        "<section>{{title}} {{basePath}} {{pages}}</section>",
        "utf8",
      );
      await writeFile(
        path.join(vaultRoot, "_templates", "style.css"),
        "body { color: red; }",
        "utf8",
      );
    },
    async (vaultRoot) => {
      const templates = await resolveTemplates(vaultRoot);

      const pageHtml = templates.renderPage({
        title: "Page",
        content: "<p>Body</p>",
        basePath: "/docs",
        siteTitle: "Site",
      });
      const indexHtml = templates.renderIndex({
        title: "Docs",
        basePath: "/docs",
        pages: [{ title: "One", url: "/docs/one/", folder: "" }],
      });

      assert.equal(pageHtml, "<article>Page Site /docs <p>Body</p></article>");
      assert.match(indexHtml, /<section>Docs \/docs/);
      assert.match(indexHtml, /One/);
      assert.equal(templates.stylesheet(), "body { color: red; }");
    },
  );
});
