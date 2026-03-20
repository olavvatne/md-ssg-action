import { glob } from "node:fs/promises";

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
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
