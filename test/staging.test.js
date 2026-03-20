import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { stageFiles } from "../src/staging.js";

async function withVault(setup, fn) {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "md-ssg-staging-"));

  try {
    await setup(vaultRoot);
    await fn(vaultRoot);
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
}

async function writeVaultFile(vaultRoot, relativePath, content) {
  const absolutePath = path.join(vaultRoot, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

test("stageFiles strips simple prefix Recipes/**", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeVaultFile(vaultRoot, "Recipes/Pasta.md", "pasta\n");
    },
    async (vaultRoot) => {
      const { stagingDir, stagedFiles } = await stageFiles({
        vaultRoot,
        files: ["Recipes/Pasta.md"],
        images: [],
        patternMap: new Map([["Recipes/Pasta.md", "Recipes/**"]]),
      });

      assert.equal(stagedFiles[0].outputRelative, "Pasta.md");
      const content = await readFile(path.join(stagingDir, "Pasta.md"), "utf8");
      assert.equal(content, "pasta\n");
    },
  );
});

test("stageFiles strips deep prefix A/B/**", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeVaultFile(vaultRoot, "A/B/C/D.md", "deep\n");
    },
    async (vaultRoot) => {
      const { stagingDir, stagedFiles } = await stageFiles({
        vaultRoot,
        files: ["A/B/C/D.md"],
        images: [],
        patternMap: new Map([["A/B/C/D.md", "A/B/**"]]),
      });

      assert.equal(stagedFiles[0].outputRelative, "C/D.md");
      const content = await readFile(path.join(stagingDir, "C", "D.md"), "utf8");
      assert.equal(content, "deep\n");
    },
  );
});

test("stageFiles keeps path unchanged for ** pattern", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeVaultFile(vaultRoot, "Notes/Todo.md", "todo\n");
    },
    async (vaultRoot) => {
      const { stagingDir, stagedFiles } = await stageFiles({
        vaultRoot,
        files: ["Notes/Todo.md"],
        images: [],
        patternMap: new Map([["Notes/Todo.md", "**"]]),
      });

      assert.equal(stagedFiles[0].outputRelative, "Notes/Todo.md");
      const content = await readFile(path.join(stagingDir, "Notes", "Todo.md"), "utf8");
      assert.equal(content, "todo\n");
    },
  );
});

test("stageFiles uses first matching pattern from patternMap", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeVaultFile(vaultRoot, "Recipes/Italian/Pasta.md", "italian\n");
    },
    async (vaultRoot) => {
      const { stagedFiles } = await stageFiles({
        vaultRoot,
        files: ["Recipes/Italian/Pasta.md"],
        images: [],
        patternMap: new Map([["Recipes/Italian/Pasta.md", "Recipes/**"]]),
      });

      assert.equal(stagedFiles[0].outputRelative, "Italian/Pasta.md");
    },
  );
});

test("stageFiles copies images to staging directory", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeVaultFile(vaultRoot, "Recipes/Pasta.md", "pasta\n");
      await writeVaultFile(vaultRoot, "images/pasta.jpg", "img\n");
    },
    async (vaultRoot) => {
      const { stagingDir } = await stageFiles({
        vaultRoot,
        files: ["Recipes/Pasta.md"],
        images: [
          {
            sourcePath: path.join(vaultRoot, "images", "pasta.jpg"),
            outputPath: "images/pasta.jpg",
          },
        ],
        patternMap: new Map([["Recipes/Pasta.md", "Recipes/**"]]),
      });

      const imageContent = await readFile(path.join(stagingDir, "images", "pasta.jpg"), "utf8");
      assert.equal(imageContent, "img\n");
    },
  );
});

test("stageFiles creates nested directories", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeVaultFile(vaultRoot, "X/Y/Z/Nested.md", "nested\n");
    },
    async (vaultRoot) => {
      const { stagingDir } = await stageFiles({
        vaultRoot,
        files: ["X/Y/Z/Nested.md"],
        images: [],
        patternMap: new Map([["X/Y/Z/Nested.md", "**"]]),
      });

      const content = await readFile(path.join(stagingDir, "X", "Y", "Z", "Nested.md"), "utf8");
      assert.equal(content, "nested\n");
    },
  );
});

test("stageFiles falls back to filename when prefix strip yields empty", async () => {
  await withVault(
    async (vaultRoot) => {
      await writeVaultFile(vaultRoot, "Recipes/Pasta.md", "single\n");
    },
    async (vaultRoot) => {
      const { stagingDir, stagedFiles } = await stageFiles({
        vaultRoot,
        files: ["Recipes/Pasta.md"],
        images: [],
        patternMap: new Map([["Recipes/Pasta.md", "Recipes/Pasta.md"]]),
      });

      assert.equal(stagedFiles[0].outputRelative, "Pasta.md");
      const content = await readFile(path.join(stagingDir, "Pasta.md"), "utf8");
      assert.equal(content, "single\n");
    },
  );
});
