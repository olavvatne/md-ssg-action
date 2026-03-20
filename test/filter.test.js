import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { globFilter, tagFilter } from "../src/filter.js";

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

test("tagFilter passes file with #publish in body text", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "body.md"), "hello #publish world\n", "utf8");
      await writeFile(path.join(vaultRoot, "other.md"), "hello world\n", "utf8");
    },
    async (vaultRoot) => {
      const files = await tagFilter(vaultRoot, ["body.md", "other.md"], "publish");
      assert.deepEqual(files, ["body.md"]);
    },
  );
});

test("tagFilter passes file with #publish at start of line", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "start.md"), "#publish\ncontent\n", "utf8");
    },
    async (vaultRoot) => {
      const files = await tagFilter(vaultRoot, ["start.md"], "publish");
      assert.deepEqual(files, ["start.md"]);
    },
  );
});

test("tagFilter rejects file without #publish", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "no-tag.md"), "no tag here\n", "utf8");
    },
    async (vaultRoot) => {
      const files = await tagFilter(vaultRoot, ["no-tag.md"], "publish");
      assert.deepEqual(files, []);
    },
  );
});

test("tagFilter rejects #publish inside fenced code blocks", async () => {
  await withVault(
    async (vaultRoot) => {
      const content = "```md\n#publish\n```\n";
      await writeFile(path.join(vaultRoot, "fenced.md"), content, "utf8");
    },
    async (vaultRoot) => {
      const files = await tagFilter(vaultRoot, ["fenced.md"], "publish");
      assert.deepEqual(files, []);
    },
  );
});

test("tagFilter rejects #publish inside inline code", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "inline.md"), "Use `#publish` here\n", "utf8");
    },
    async (vaultRoot) => {
      const files = await tagFilter(vaultRoot, ["inline.md"], "publish");
      assert.deepEqual(files, []);
    },
  );
});

test("tagFilter passes #publish inside a heading", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "heading.md"), "## #publish\n", "utf8");
    },
    async (vaultRoot) => {
      const files = await tagFilter(vaultRoot, ["heading.md"], "publish");
      assert.deepEqual(files, ["heading.md"]);
    },
  );
});

test("tagFilter supports custom tag names", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "custom.md"), "#release-now\n", "utf8");
      await writeFile(path.join(vaultRoot, "publish.md"), "#publish\n", "utf8");
    },
    async (vaultRoot) => {
      const files = await tagFilter(vaultRoot, ["custom.md", "publish.md"], "release-now");
      assert.deepEqual(files, ["custom.md"]);
    },
  );
});

test("tagFilter rejects #publish as part of another word", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "word.md"), "something#publish should fail\n", "utf8");
    },
    async (vaultRoot) => {
      const files = await tagFilter(vaultRoot, ["word.md"], "publish");
      assert.deepEqual(files, []);
    },
  );
});

test("tagFilter rejects empty files", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "empty.md"), "", "utf8");
    },
    async (vaultRoot) => {
      const files = await tagFilter(vaultRoot, ["empty.md"], "publish");
      assert.deepEqual(files, []);
    },
  );
});
