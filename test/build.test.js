import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "../src/build.js";

async function withWorkspace(setup, fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "md-ssg-build-"));
  const vaultRoot = path.join(root, "vault");
  const stagingDir = path.join(root, "staging");
  const outputDir = path.join(root, "_site");

  await mkdir(vaultRoot, { recursive: true });
  await mkdir(stagingDir, { recursive: true });

  try {
    await setup({ root, vaultRoot, stagingDir, outputDir });
    await fn({ root, vaultRoot, stagingDir, outputDir });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeStagedFile(stagingDir, outputRelative, content) {
  const stagedPath = path.join(stagingDir, outputRelative);
  await mkdir(path.dirname(stagedPath), { recursive: true });
  await writeFile(stagedPath, content, "utf8");
  return {
    inputPath: path.join(stagingDir, outputRelative),
    stagedPath,
    outputRelative,
  };
}

function createCoreMock() {
  const info = [];
  const warning = [];

  return {
    core: {
      info: (message) => info.push(message),
      warning: (message) => warning.push(message),
    },
    logs: { info, warning },
  };
}

test("build creates page html for a single staged file", async () => {
  await withWorkspace(
    async ({ stagingDir }) => {
      await writeStagedFile(stagingDir, "Italian/Pasta.md", "# Pasta\n\nBody\n");
    },
    async ({ vaultRoot, stagingDir, outputDir }) => {
      const { core } = createCoreMock();
      const stagedFiles = [
        {
          inputPath: path.join(stagingDir, "Italian/Pasta.md"),
          stagedPath: path.join(stagingDir, "Italian/Pasta.md"),
          outputRelative: "Italian/Pasta.md",
        },
      ];

      await build(
        {
          config: { include: ["**"], tag: "publish", title: "Recipes", basePath: "/base" },
          stagedFiles,
          images: [],
          stagingDir,
          outputDir,
          vaultRoot,
        },
        { core },
      );

      const html = await readFile(path.join(outputDir, "Italian", "Pasta", "index.html"), "utf8");
      assert.match(html, /<h1>Pasta<\/h1>/);
    },
  );
});

test("build renders multiple files and generates index entries", async () => {
  await withWorkspace(
    async ({ stagingDir }) => {
      await writeStagedFile(stagingDir, "Italian/Pasta.md", "# Pasta\n");
      await writeStagedFile(stagingDir, "Asian/Ramen.md", "# Ramen\n");
    },
    async ({ vaultRoot, stagingDir, outputDir }) => {
      const { core } = createCoreMock();
      const stagedFiles = [
        {
          inputPath: path.join(stagingDir, "Italian/Pasta.md"),
          stagedPath: path.join(stagingDir, "Italian/Pasta.md"),
          outputRelative: "Italian/Pasta.md",
        },
        {
          inputPath: path.join(stagingDir, "Asian/Ramen.md"),
          stagedPath: path.join(stagingDir, "Asian/Ramen.md"),
          outputRelative: "Asian/Ramen.md",
        },
      ];

      await build(
        {
          config: { include: ["**"], tag: "publish", title: "Recipes", basePath: "/base" },
          stagedFiles,
          images: [],
          stagingDir,
          outputDir,
          vaultRoot,
        },
        { core },
      );

      const indexHtml = await readFile(path.join(outputDir, "index.html"), "utf8");
      assert.match(indexHtml, /Italian/);
      assert.match(indexHtml, /Asian/);
      assert.match(indexHtml, /\/base\/Italian\/Pasta\//);
      assert.match(indexHtml, /\/base\/Asian\/Ramen\//);
    },
  );
});

test("build wiki-link map resolves links using extracted H1 titles", async () => {
  await withWorkspace(
    async ({ stagingDir }) => {
      await writeStagedFile(stagingDir, "Italian/Pasta.md", "# Great Pasta\n");
      await writeStagedFile(stagingDir, "Notes/Index.md", "See [[Great Pasta]].\n");
    },
    async ({ vaultRoot, stagingDir, outputDir }) => {
      const { core } = createCoreMock();
      const stagedFiles = [
        {
          inputPath: path.join(stagingDir, "Italian/Pasta.md"),
          stagedPath: path.join(stagingDir, "Italian/Pasta.md"),
          outputRelative: "Italian/Pasta.md",
        },
        {
          inputPath: path.join(stagingDir, "Notes/Index.md"),
          stagedPath: path.join(stagingDir, "Notes/Index.md"),
          outputRelative: "Notes/Index.md",
        },
      ];

      await build(
        {
          config: { include: ["**"], tag: "publish", title: "Recipes", basePath: "/base" },
          stagedFiles,
          images: [],
          stagingDir,
          outputDir,
          vaultRoot,
        },
        { core },
      );

      const html = await readFile(path.join(outputDir, "Notes", "Index", "index.html"), "utf8");
      assert.match(html, /<a href="\/base\/Italian\/Pasta\/">Great Pasta<\/a>/);
    },
  );
});

test("build falls back to filename when no H1 exists", async () => {
  await withWorkspace(
    async ({ stagingDir }) => {
      await writeStagedFile(stagingDir, "Root/NoTitle.md", "Paragraph only\n");
    },
    async ({ vaultRoot, stagingDir, outputDir }) => {
      const { core } = createCoreMock();
      const stagedFiles = [
        {
          inputPath: path.join(stagingDir, "Root/NoTitle.md"),
          stagedPath: path.join(stagingDir, "Root/NoTitle.md"),
          outputRelative: "Root/NoTitle.md",
        },
      ];

      await build(
        {
          config: { include: ["**"], tag: "publish", title: "Recipes", basePath: "/base" },
          stagedFiles,
          images: [],
          stagingDir,
          outputDir,
          vaultRoot,
        },
        { core },
      );

      const html = await readFile(path.join(outputDir, "Root", "NoTitle", "index.html"), "utf8");
      assert.match(html, /<title>NoTitle - Recipes<\/title>/);
    },
  );
});

test("build copies images to output paths", async () => {
  await withWorkspace(
    async ({ vaultRoot, stagingDir }) => {
      await writeStagedFile(stagingDir, "One.md", "# One\n");
      await mkdir(path.join(vaultRoot, "images"), { recursive: true });
      await writeFile(path.join(vaultRoot, "images", "one.png"), "png", "utf8");
    },
    async ({ vaultRoot, stagingDir, outputDir }) => {
      const { core } = createCoreMock();
      const stagedFiles = [
        {
          inputPath: path.join(stagingDir, "One.md"),
          stagedPath: path.join(stagingDir, "One.md"),
          outputRelative: "One.md",
        },
      ];

      await build(
        {
          config: { include: ["**"], tag: "publish", title: "Recipes", basePath: "/base" },
          stagedFiles,
          images: [
            {
              sourcePath: path.join(vaultRoot, "images", "one.png"),
              outputPath: "images/one.png",
            },
          ],
          stagingDir,
          outputDir,
          vaultRoot,
        },
        { core },
      );

      const image = await readFile(path.join(outputDir, "images", "one.png"), "utf8");
      assert.equal(image, "png");
    },
  );
});

test("build writes stylesheet to output root", async () => {
  await withWorkspace(
    async ({ stagingDir }) => {
      await writeStagedFile(stagingDir, "One.md", "# One\n");
    },
    async ({ vaultRoot, stagingDir, outputDir }) => {
      const { core } = createCoreMock();
      const stagedFiles = [
        {
          inputPath: path.join(stagingDir, "One.md"),
          stagedPath: path.join(stagingDir, "One.md"),
          outputRelative: "One.md",
        },
      ];

      await build(
        {
          config: { include: ["**"], tag: "publish", title: "Recipes", basePath: "/base" },
          stagedFiles,
          images: [],
          stagingDir,
          outputDir,
          vaultRoot,
        },
        { core },
      );

      const css = await readFile(path.join(outputDir, "style.css"), "utf8");
      assert.match(css, /\.dead-link/);
    },
  );
});

test("build logs warning and continues when a file cannot be rendered", async () => {
  await withWorkspace(
    async ({ stagingDir }) => {
      await writeStagedFile(stagingDir, "Good.md", "# Good\n");
    },
    async ({ vaultRoot, stagingDir, outputDir }) => {
      const { core, logs } = createCoreMock();
      const stagedFiles = [
        {
          inputPath: path.join(stagingDir, "Missing.md"),
          stagedPath: path.join(stagingDir, "Missing.md"),
          outputRelative: "Missing.md",
        },
        {
          inputPath: path.join(stagingDir, "Good.md"),
          stagedPath: path.join(stagingDir, "Good.md"),
          outputRelative: "Good.md",
        },
      ];

      await build(
        {
          config: { include: ["**"], tag: "publish", title: "Recipes", basePath: "/base" },
          stagedFiles,
          images: [],
          stagingDir,
          outputDir,
          vaultRoot,
        },
        { core },
      );

      const goodHtml = await readFile(path.join(outputDir, "Good", "index.html"), "utf8");
      assert.match(goodHtml, /<h1>Good<\/h1>/);
      assert.equal(logs.warning.length, 1);
      assert.match(logs.warning[0], /Failed to render Missing\.md/);
    },
  );
});
