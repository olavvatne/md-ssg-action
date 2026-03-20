import { copyFile, mkdir, mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function getStaticPrefix(pattern) {
  const normalizedPattern = normalizePath(pattern);
  const firstGlobIndex = normalizedPattern.search(/[?*[{]/);

  if (firstGlobIndex === -1) {
    return normalizedPattern;
  }

  return normalizedPattern.slice(0, firstGlobIndex);
}

function stripStaticPrefix(filePath, pattern) {
  const normalizedFile = normalizePath(filePath);
  const prefix = getStaticPrefix(pattern);

  if (!prefix) {
    return normalizedFile;
  }

  if (!normalizedFile.startsWith(prefix)) {
    return normalizedFile;
  }

  const stripped = normalizedFile.slice(prefix.length).replace(/^\/+/, "");
  if (!stripped) {
    return path.posix.basename(normalizedFile);
  }

  return stripped;
}

async function copyWithParents(sourcePath, destinationPath) {
  await mkdir(path.dirname(destinationPath), { recursive: true });
  await copyFile(sourcePath, destinationPath);
}

export async function stageFiles(opts) {
  const { vaultRoot, files, images, patternMap } = opts;

  const stagingDir = await mkdtemp(path.join(os.tmpdir(), "md-ssg-stage-"));
  const stagedFiles = [];

  for (const file of files) {
    const sourcePath = path.join(vaultRoot, file);
    const pattern = patternMap.get(file) ?? "**";
    const outputRelative = stripStaticPrefix(file, pattern);
    const destinationPath = path.join(stagingDir, outputRelative);

    await copyWithParents(sourcePath, destinationPath);

    stagedFiles.push({
      inputPath: sourcePath,
      stagedPath: destinationPath,
      outputRelative,
    });
  }

  for (const image of images) {
    const destinationPath = path.join(stagingDir, image.outputPath);
    await copyWithParents(image.sourcePath, destinationPath);
  }

  return { stagingDir, stagedFiles };
}
