import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { extractImages } from "../src/assets.js";

async function withVault(setup, fn) {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "md-ssg-assets-"));

  try {
    await setup(vaultRoot);
    await fn(vaultRoot);
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
}

test("extractImages extracts standard markdown image references", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "note.md"), "![alt](img.png)\n", "utf8");
      await writeFile(path.join(vaultRoot, "img.png"), "png", "utf8");
    },
    async (vaultRoot) => {
      const warnings = [];
      const images = await extractImages(vaultRoot, ["note.md"], {
        core: { warning: (message) => warnings.push(message) },
      });

      assert.equal(warnings.length, 0);
      assert.equal(images.length, 1);
      assert.equal(images[0].outputPath, "img.png");
    },
  );
});

test("extractImages extracts Obsidian image embeds", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "note.md"), "![[photo.jpg]]\n", "utf8");
      await writeFile(path.join(vaultRoot, "photo.jpg"), "jpg", "utf8");
    },
    async (vaultRoot) => {
      const images = await extractImages(vaultRoot, ["note.md"], {
        core: { warning: () => {} },
      });

      assert.equal(images.length, 1);
      assert.equal(images[0].outputPath, "photo.jpg");
    },
  );
});

test("extractImages resolves standard image paths relative to referring file", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "docs", "guides"), { recursive: true });
      await mkdir(path.join(vaultRoot, "docs", "images"), { recursive: true });
      await writeFile(
        path.join(vaultRoot, "docs", "guides", "note.md"),
        "![](../images/a.png)\n",
        "utf8",
      );
      await writeFile(path.join(vaultRoot, "docs", "images", "a.png"), "png", "utf8");
    },
    async (vaultRoot) => {
      const images = await extractImages(vaultRoot, ["docs/guides/note.md"], {
        core: { warning: () => {} },
      });

      assert.equal(images.length, 1);
      assert.equal(images[0].outputPath, "docs/images/a.png");
    },
  );
});

test("extractImages skips external URLs", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "note.md"), "![](https://example.com/a.png)\n", "utf8");
    },
    async (vaultRoot) => {
      const warnings = [];
      const images = await extractImages(vaultRoot, ["note.md"], {
        core: { warning: (message) => warnings.push(message) },
      });

      assert.deepEqual(images, []);
      assert.equal(warnings.length, 0);
    },
  );
});

test("extractImages skips non-image Obsidian embeds", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "note.md"), "![[note.md]]\n", "utf8");
    },
    async (vaultRoot) => {
      const warnings = [];
      const images = await extractImages(vaultRoot, ["note.md"], {
        core: { warning: (message) => warnings.push(message) },
      });

      assert.deepEqual(images, []);
      assert.equal(warnings.length, 0);
    },
  );
});

test("extractImages deduplicates repeated references across files", async () => {
  await withVault(
    async (vaultRoot) => {
      await mkdir(path.join(vaultRoot, "docs"), { recursive: true });
      await writeFile(path.join(vaultRoot, "docs", "a.md"), "![](../img.png)\n", "utf8");
      await writeFile(path.join(vaultRoot, "docs", "b.md"), "![[img.png]]\n", "utf8");
      await writeFile(path.join(vaultRoot, "img.png"), "png", "utf8");
    },
    async (vaultRoot) => {
      const images = await extractImages(vaultRoot, ["docs/a.md", "docs/b.md"], {
        core: { warning: () => {} },
      });

      assert.equal(images.length, 1);
      assert.equal(images[0].outputPath, "img.png");
    },
  );
});

test("extractImages warns and skips missing image files", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "note.md"), "![](missing.png)\n", "utf8");
    },
    async (vaultRoot) => {
      const warnings = [];
      const images = await extractImages(vaultRoot, ["note.md"], {
        core: { warning: (message) => warnings.push(message) },
      });

      assert.deepEqual(images, []);
      assert.equal(warnings.length, 1);
      assert.match(warnings[0], /Image reference not found: missing\.png in note\.md/);
    },
  );
});

test("extractImages strips query strings and resolves image paths", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeFile(path.join(vaultRoot, "note.md"), "![](img.png?size=100)\n", "utf8");
      await writeFile(path.join(vaultRoot, "img.png"), "png", "utf8");
    },
    async (vaultRoot) => {
      const warnings = [];
      const images = await extractImages(vaultRoot, ["note.md"], {
        core: { warning: (message) => warnings.push(message) },
      });

      assert.equal(warnings.length, 0);
      assert.equal(images.length, 1);
      assert.equal(images[0].outputPath, "img.png");
    },
  );
});
