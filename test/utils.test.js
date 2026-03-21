import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { escapeHtml, fileExists, normalizeBasePath, normalizePath } from "../src/utils.js";

test("normalizePath converts backslashes to forward slashes", () => {
  assert.equal(normalizePath("a\\b\\c.md"), "a/b/c.md");
  assert.equal(normalizePath("a/b/c.md"), "a/b/c.md");
});

test("normalizeBasePath removes trailing slash and normalizes root", () => {
  assert.equal(normalizeBasePath("/"), "");
  assert.equal(normalizeBasePath(""), "");
  assert.equal(normalizeBasePath("/docs/"), "/docs");
  assert.equal(normalizeBasePath("/docs"), "/docs");
});

test("escapeHtml escapes special characters", () => {
  assert.equal(
    escapeHtml("<tag a='x' b=\"y\">&</tag>"),
    "&lt;tag a=&#39;x&#39; b=&quot;y&quot;&gt;&amp;&lt;/tag&gt;",
  );
});

test("fileExists returns true for existing files and false for missing files", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "md-ssg-utils-"));
  const existingPath = path.join(tempDir, "exists.txt");
  const missingPath = path.join(tempDir, "missing.txt");

  try {
    await writeFile(existingPath, "ok", "utf8");

    assert.equal(await fileExists(existingPath), true);
    assert.equal(await fileExists(missingPath), false);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
