import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { run } from "../src/main.js";

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function withFixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "md-ssg-main-"));
  const vaultRoot = path.join(root, "vault");
  const siteLocation = path.join(root, "_site");

  await mkdir(path.join(vaultRoot, "Notes", "images"), { recursive: true });
  await mkdir(path.join(vaultRoot, "Private"), { recursive: true });

  await writeFile(
    path.join(vaultRoot, ".md-ssg.yml"),
    [
      "include:",
      '  - "Notes/**"',
      'tag: "publish"',
      'title: "My Site"',
      'base-path: "/base"',
      "",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(vaultRoot, "Notes", "Published.md"),
    [
      "---",
      "title: should not render",
      "---",
      "# Published",
      "",
      "#publish",
      "",
      "See [[Other]] and [[Secret]].",
      "",
      "![](../images/diagram.png)",
      "",
    ].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(vaultRoot, "Notes", "Other.md"),
    ["# Other", "", "#publish", "", "Linked back to [[Published]].", ""].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(vaultRoot, "Notes", "Secret.md"),
    ["# Secret", "", "No publish tag here.", ""].join("\n"),
    "utf8",
  );

  await writeFile(
    path.join(vaultRoot, "Private", "Journal.md"),
    ["# Journal", "", "#publish", ""].join("\n"),
    "utf8",
  );

  await writeFile(path.join(vaultRoot, "images", "diagram.png"), "png", "utf8").catch(async () => {
    await mkdir(path.join(vaultRoot, "images"), { recursive: true });
    await writeFile(path.join(vaultRoot, "images", "diagram.png"), "png", "utf8");
  });

  const logs = {
    info: [],
    warning: [],
    failed: [],
  };

  const deps = {
    core: {
      getInput: (name) => {
        if (name === "markdown-location") {
          return vaultRoot;
        }

        if (name === "site-location") {
          return siteLocation;
        }

        return "";
      },
      info: (message) => logs.info.push(message),
      warning: (message) => logs.warning.push(message),
      setFailed: (message) => logs.failed.push(message),
    },
    github: {
      context: {
        repo: {
          repo: "repo-name",
        },
      },
    },
  };

  try {
    await fn({ root, vaultRoot, siteLocation, deps, logs });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("run builds full site and enforces glob+tag filtering", async () => {
  await withFixture(async ({ siteLocation, deps, logs }) => {
    await run(deps);

    assert.equal(logs.failed.length, 0);

    const publishedPath = path.join(siteLocation, "Published", "index.html");
    const otherPath = path.join(siteLocation, "Other", "index.html");
    const secretPath = path.join(siteLocation, "Secret", "index.html");
    const journalPath = path.join(siteLocation, "Journal", "index.html");
    const indexPath = path.join(siteLocation, "index.html");
    const cssPath = path.join(siteLocation, "style.css");
    const imagePath = path.join(siteLocation, "images", "diagram.png");

    assert.equal(await pathExists(publishedPath), true);
    assert.equal(await pathExists(otherPath), true);
    assert.equal(await pathExists(secretPath), false);
    assert.equal(await pathExists(journalPath), false);
    assert.equal(await pathExists(indexPath), true);
    assert.equal(await pathExists(cssPath), true);
    assert.equal(await pathExists(imagePath), true);

    const publishedHtml = await readFile(publishedPath, "utf8");
    const indexHtml = await readFile(indexPath, "utf8");

    assert.match(publishedHtml, /<h1>Published<\/h1>/);
    assert.match(publishedHtml, /<a href="\/base\/Other\/">Other<\/a>/);
    assert.match(publishedHtml, /<span class="dead-link">Secret<\/span>/);
    assert.doesNotMatch(publishedHtml, /title: should not render/);

    assert.match(indexHtml, /Published/);
    assert.match(indexHtml, /Other/);
    assert.doesNotMatch(indexHtml, /Secret/);
    assert.doesNotMatch(indexHtml, /Journal/);
  });
});

test("run reports errors via setFailed", async () => {
  const logs = { failed: [] };

  await run({
    core: {
      getInput: () => "/no/such/path",
      info: () => {},
      warning: () => {},
      setFailed: (message) => logs.failed.push(message),
    },
    github: {
      context: {
        repo: {
          repo: "repo-name",
        },
      },
    },
  });

  assert.equal(logs.failed.length, 1);
  assert.match(logs.failed[0], /Missing \.md-ssg\.yml/);
});
