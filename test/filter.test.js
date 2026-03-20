import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { globFilter } from "../src/filter.js";

async function withVault(setup, fn) {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "md-ssg-filter-"));

  try {
    await setup(vaultRoot);
    await fn(vaultRoot);
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
}

test("globFilter includes files inside glob pattern", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "docs"), { recursive: true });
      await writeFile(path.join(vaultRoot, "docs", "in.md"), "# In\n", "utf8");
      await writeFile(path.join(vaultRoot, "other.md"), "# Out\n", "utf8");
    },
    async (vaultRoot) => {
      const { files } = await globFilter(vaultRoot, ["docs/**"]);
      assert.deepEqual(files, ["docs/in.md"]);
    },
  );
});

test("globFilter excludes non-md files inside pattern", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "docs"), { recursive: true });
      await writeFile(path.join(vaultRoot, "docs", "keep.md"), "# Keep\n", "utf8");
      await writeFile(path.join(vaultRoot, "docs", "skip.txt"), "skip\n", "utf8");
    },
    async (vaultRoot) => {
      const { files } = await globFilter(vaultRoot, ["docs/**"]);
      assert.deepEqual(files, ["docs/keep.md"]);
    },
  );
});

test("globFilter deduplicates overlaps and stores first matching pattern", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "docs", "nested"), { recursive: true });
      await writeFile(path.join(vaultRoot, "docs", "nested", "note.md"), "# Note\n", "utf8");
    },
    async (vaultRoot) => {
      const { files, patternMap } = await globFilter(vaultRoot, ["docs/**", "**/*.md"]);

      assert.deepEqual(files, ["docs/nested/note.md"]);
      assert.equal(patternMap.get("docs/nested/note.md"), "docs/**");
      assert.equal(patternMap.size, 1);
    },
  );
});

test("globFilter matches deeply nested files with **", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "a", "b", "c"), { recursive: true });
      await writeFile(path.join(vaultRoot, "a", "b", "c", "deep.md"), "# Deep\n", "utf8");
    },
    async (vaultRoot) => {
      const { files } = await globFilter(vaultRoot, ["a/**"]);
      assert.deepEqual(files, ["a/b/c/deep.md"]);
    },
  );
});

test("globFilter respects folder-prefixed patterns", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "recipes"), { recursive: true });
      await mkdir(path.join(vaultRoot, "notes"), { recursive: true });
      await writeFile(path.join(vaultRoot, "recipes", "cake.md"), "# Cake\n", "utf8");
      await writeFile(path.join(vaultRoot, "notes", "cake.md"), "# Note\n", "utf8");
    },
    async (vaultRoot) => {
      const { files } = await globFilter(vaultRoot, ["recipes/**"]);
      assert.deepEqual(files, ["recipes/cake.md"]);
    },
  );
});

test("globFilter returns empty results for empty directory", async () => {
  await withVault(
    async () => {},
    async (vaultRoot) => {
      const { files, patternMap } = await globFilter(vaultRoot, ["**"]);
      assert.deepEqual(files, []);
      assert.equal(patternMap.size, 0);
    },
  );
});
