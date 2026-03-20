import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { parseConfig } from "../src/config.js";

const github = {
  context: {
    repo: {
      repo: "test-repo",
    },
  },
};

async function withVault(configContent, fn) {
  const vaultRoot = await mkdtemp(path.join(os.tmpdir(), "md-ssg-config-"));

  if (configContent !== null) {
    await writeFile(path.join(vaultRoot, ".md-ssg.yml"), configContent, "utf8");
  }

  try {
    await fn(vaultRoot);
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
}

test("valid minimal config applies defaults", async () => {
  await withVault('include:\n  - "**"\n', async (vaultRoot) => {
    const config = await parseConfig(vaultRoot, { github });

    assert.deepEqual(config, {
      include: ["**"],
      tag: "publish",
      title: "test-repo",
      basePath: "/test-repo",
    });
  });
});

test("valid full config returns provided values", async () => {
  await withVault(
    'include:\n  - "Recipes/**"\ntag: "release"\ntitle: "My Site"\nbase-path: "/custom"\n',
    async (vaultRoot) => {
      const config = await parseConfig(vaultRoot, { github });

      assert.deepEqual(config, {
        include: ["Recipes/**"],
        tag: "release",
        title: "My Site",
        basePath: "/custom",
      });
    },
  );
});

test("missing include throws descriptive error", async () => {
  await withVault('tag: "publish"\n', async (vaultRoot) => {
    await assert.rejects(parseConfig(vaultRoot, { github }), {
      message: ".md-ssg.yml: 'include' must be a non-empty array of glob patterns",
    });
  });
});

test("empty include array throws", async () => {
  await withVault("include: []\n", async (vaultRoot) => {
    await assert.rejects(parseConfig(vaultRoot, { github }), {
      message: ".md-ssg.yml: 'include' must be a non-empty array of glob patterns",
    });
  });
});

test("include not array throws", async () => {
  await withVault('include: "**"\n', async (vaultRoot) => {
    await assert.rejects(parseConfig(vaultRoot, { github }), {
      message: ".md-ssg.yml: 'include' must be a non-empty array of glob patterns",
    });
  });
});

test("invalid tag characters throw", async () => {
  await withVault('include:\n  - "**"\ntag: "pub lish"\n', async (vaultRoot) => {
    await assert.rejects(parseConfig(vaultRoot, { github }), {
      message: ".md-ssg.yml: 'tag' must contain only word characters",
    });
  });
});

test("invalid base-path without leading slash throws", async () => {
  await withVault('include:\n  - "**"\nbase-path: "no-slash"\n', async (vaultRoot) => {
    await assert.rejects(parseConfig(vaultRoot, { github }), {
      message: ".md-ssg.yml: 'base-path' must start with '/'",
    });
  });
});

test("base-path with trailing slash throws", async () => {
  await withVault('include:\n  - "**"\nbase-path: "/repo/"\n', async (vaultRoot) => {
    await assert.rejects(parseConfig(vaultRoot, { github }), {
      message: ".md-ssg.yml: 'base-path' must start with '/'",
    });
  });
});

test("base-path exactly slash is allowed", async () => {
  await withVault('include:\n  - "**"\nbase-path: "/"\n', async (vaultRoot) => {
    const config = await parseConfig(vaultRoot, { github });

    assert.equal(config.basePath, "/");
  });
});

test("empty file throws missing include error", async () => {
  await withVault("", async (vaultRoot) => {
    await assert.rejects(parseConfig(vaultRoot, { github }), {
      message: ".md-ssg.yml: 'include' must be a non-empty array of glob patterns",
    });
  });
});

test("missing file throws file not found error", async () => {
  await withVault(null, async (vaultRoot) => {
    await assert.rejects(parseConfig(vaultRoot, { github }), {
      message: `Missing .md-ssg.yml in vault root: ${path.join(vaultRoot, ".md-ssg.yml")}`,
    });
  });
});

test("unknown keys are ignored", async () => {
  await withVault('include:\n  - "**"\nextra: true\n', async (vaultRoot) => {
    const config = await parseConfig(vaultRoot, { github });

    assert.deepEqual(config, {
      include: ["**"],
      tag: "publish",
      title: "test-repo",
      basePath: "/test-repo",
    });
  });
});
