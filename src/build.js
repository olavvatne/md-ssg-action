import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createProcessor, renderFile } from "./render.js";
import { resolveTemplates } from "./templates.js";

function normalizePath(filePath) {
  return filePath.replaceAll("\\", "/");
}

function stripMarkdownExtension(filePath) {
  return filePath.replace(/\.md$/i, "");
}

function normalizeBasePath(basePath) {
  if (!basePath || basePath === "/") {
    return "";
  }

  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

function outputRelativeToUrl(basePath, outputRelative) {
  const normalizedBasePath = normalizeBasePath(basePath);
  const withoutExtension = stripMarkdownExtension(normalizePath(outputRelative));
  return `${normalizedBasePath}/${withoutExtension}/`;
}

function outputRelativeToHtmlPath(outputDir, outputRelative) {
  const withoutExtension = stripMarkdownExtension(normalizePath(outputRelative));
  return path.join(outputDir, withoutExtension, "index.html");
}

function outputRelativeToFolder(outputRelative) {
  const normalized = normalizePath(outputRelative);
  const segments = normalized.split("/");
  if (segments.length <= 1) {
    return "";
  }

  return segments[0];
}

function outputRelativeToFallbackTitle(outputRelative) {
  const normalized = normalizePath(outputRelative);
  const baseName = path.posix.basename(normalized);
  return stripMarkdownExtension(baseName);
}

function extractHeadingTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  if (!match) {
    return null;
  }

  return match[1].trim() || null;
}

async function buildWikiLinkMap(basePath, stagedFiles) {
  const map = new Map();

  for (const stagedFile of stagedFiles) {
    const normalizedOutputRelative = normalizePath(stagedFile.outputRelative);
    const fileName = outputRelativeToFallbackTitle(normalizedOutputRelative).toLowerCase();
    const url = outputRelativeToUrl(basePath, normalizedOutputRelative);

    map.set(fileName, url);

    try {
      const content = await readFile(stagedFile.stagedPath, "utf8");
      const headingTitle = extractHeadingTitle(content);

      if (headingTitle) {
        map.set(headingTitle.toLowerCase(), url);
      }
    } catch {
      // Render phase handles warnings; missing title map entry is non-fatal.
    }
  }

  return map;
}

export async function build(opts, deps) {
  const resolvedDeps = deps ?? { core: await import("@actions/core") };
  const { core } = resolvedDeps;
  const { config, stagedFiles, images, outputDir, vaultRoot } = opts;

  await mkdir(outputDir, { recursive: true });

  const publishedFiles = await buildWikiLinkMap(config.basePath, stagedFiles);
  const processor = createProcessor({
    publishedFiles,
    basePath: config.basePath,
  });
  const templates = await resolveTemplates(vaultRoot);

  const indexPages = [];

  for (const stagedFile of stagedFiles) {
    try {
      const markdown = await readFile(stagedFile.stagedPath, "utf8");
      const { html, title } = await renderFile(processor, markdown);
      const pageTitle = title ?? outputRelativeToFallbackTitle(stagedFile.outputRelative);
      const url = outputRelativeToUrl(config.basePath, stagedFile.outputRelative);
      const folder = outputRelativeToFolder(stagedFile.outputRelative);

      const pageHtml = templates.renderPage({
        title: pageTitle,
        content: html,
        basePath: config.basePath,
        siteTitle: config.title,
      });

      const pageOutputPath = outputRelativeToHtmlPath(outputDir, stagedFile.outputRelative);
      await mkdir(path.dirname(pageOutputPath), { recursive: true });
      await writeFile(pageOutputPath, pageHtml, "utf8");

      indexPages.push({
        title: pageTitle,
        url,
        folder,
      });
    } catch (error) {
      core.warning(`Failed to render ${stagedFile.outputRelative}: ${error.message}`);
    }
  }

  const indexHtml = templates.renderIndex({
    title: config.title,
    pages: indexPages,
    basePath: config.basePath,
  });
  await writeFile(path.join(outputDir, "index.html"), indexHtml, "utf8");

  for (const image of images) {
    try {
      const sourcePath = image.sourcePath ?? path.join(vaultRoot, image.outputPath);
      const destinationPath = path.join(outputDir, image.outputPath);
      await mkdir(path.dirname(destinationPath), { recursive: true });
      await copyFile(sourcePath, destinationPath);
    } catch (error) {
      core.warning(`Failed to copy image ${image.outputPath}: ${error.message}`);
    }
  }

  await writeFile(path.join(outputDir, "style.css"), templates.stylesheet(), "utf8");
  await writeFile(path.join(outputDir, "favicon.svg"), templates.favicon(), "utf8");

  core.info(`Published ${indexPages.length} pages`);
  core.info(`Copied ${images.length} images`);
}
