import { glob } from "node:fs/promises";
import { readFile } from "node:fs/promises";
import path from "node:path";

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripCode(content) {
  const withoutFencedBlocks = content.replace(/^```[\s\S]*?^```/gm, "");
  return withoutFencedBlocks.replace(/`[^`]+`/g, "");
}

export async function globFilter(vaultRoot, patterns) {
  const filesSet = new Set();
  const patternMap = new Map();

  for (const pattern of patterns) {
    for await (const matchedPath of glob(pattern, { cwd: vaultRoot })) {
      const normalizedPath = normalizePath(matchedPath);

      if (!normalizedPath.endsWith(".md")) {
        continue;
      }

      if (!patternMap.has(normalizedPath)) {
        patternMap.set(normalizedPath, pattern);
      }

      filesSet.add(normalizedPath);
    }
  }

  const files = [...filesSet].sort();
  return { files, patternMap };
}

export async function tagFilter(vaultRoot, files, tag) {
  const escapedTag = escapeRegex(tag);
  const tagRegex = new RegExp(`(?:^|\\s)#${escapedTag}(?:\\s|$)`, "m");
  const filtered = [];

  for (const file of files) {
    const absolutePath = path.join(vaultRoot, file);
    const content = await readFile(absolutePath, "utf8");
    const stripped = stripCode(content);

    if (tagRegex.test(stripped)) {
      filtered.push(file);
    }
  }

  return filtered;
}
