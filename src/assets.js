import { access, readFile } from "node:fs/promises";
import path from "node:path";

const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
const OBSIDIAN_IMAGE_REGEX = /!\[\[([^\]|]+(?:\.(png|jpg|jpeg|gif|svg|webp|avif|bmp|ico)))\]\]/gi;
const EXTERNAL_URL_REGEX = /^[a-z][a-z\d+.-]*:\/\//i;

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function sanitizeReference(rawPath) {
  return rawPath.split(/[?#]/, 1)[0].trim();
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function resolveCandidates(vaultRoot, markdownFile, referencePath) {
  const cleanPath = sanitizeReference(referencePath);

  if (!cleanPath || EXTERNAL_URL_REGEX.test(cleanPath)) {
    return [];
  }

  const fileDir = path.dirname(path.join(vaultRoot, markdownFile));
  const relativeToFile = path.resolve(fileDir, cleanPath);

  const vaultRelativePath = cleanPath.startsWith("/") ? cleanPath.slice(1) : cleanPath;
  const relativeToVault = path.resolve(vaultRoot, vaultRelativePath);

  if (relativeToFile === relativeToVault) {
    return [relativeToFile];
  }

  return [relativeToFile, relativeToVault];
}

function collectReferences(markdownContent) {
  const references = [];

  for (const match of markdownContent.matchAll(MARKDOWN_IMAGE_REGEX)) {
    references.push(match[2]);
  }

  for (const match of markdownContent.matchAll(OBSIDIAN_IMAGE_REGEX)) {
    references.push(match[1]);
  }

  return references;
}

export async function extractImages(vaultRoot, files, deps) {
  const resolvedDeps = deps ?? { core: await import("@actions/core") };
  const { core } = resolvedDeps;

  const uniqueSourcePaths = new Set();

  for (const file of files) {
    const markdownPath = path.join(vaultRoot, file);
    const markdownContent = await readFile(markdownPath, "utf8");
    const references = collectReferences(markdownContent);

    for (const reference of references) {
      const candidates = resolveCandidates(vaultRoot, file, reference);
      if (candidates.length === 0) {
        continue;
      }

      let resolvedPath;

      for (const candidate of candidates) {
        if (await exists(candidate)) {
          resolvedPath = candidate;
          break;
        }
      }

      if (!resolvedPath) {
        core.warning(`Image reference not found: ${reference} in ${file}`);
        continue;
      }

      uniqueSourcePaths.add(resolvedPath);
    }
  }

  return [...uniqueSourcePaths]
    .sort((a, b) => a.localeCompare(b))
    .map((sourcePath) => ({
      sourcePath,
      outputPath: normalizePath(path.relative(vaultRoot, sourcePath)),
    }));
}
