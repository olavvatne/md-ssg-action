import { readFileSync } from "node:fs";
import { readFile as readFileAsync } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { escapeHtml, fileExists, normalizeBasePath } from "./utils.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultsDir = path.join(currentDir, "defaults");
const defaultPageTemplate = readFileSync(path.join(defaultsDir, "page.html"), "utf8");
const defaultIndexTemplate = readFileSync(path.join(defaultsDir, "index.html"), "utf8");
const defaultStyles = readFileSync(path.join(defaultsDir, "style.css"), "utf8");
const defaultIcon = readFileSync(path.join(defaultsDir, "favicon.svg"), "utf8");

function groupPagesByFolder(pages) {
  const groups = new Map();

  for (const page of pages) {
    const folder = page.folder || "";
    if (!groups.has(folder)) {
      groups.set(folder, []);
    }
    groups.get(folder).push(page);
  }

  return groups;
}

function renderPageList(pages) {
  if (pages.length === 0) {
    return "<p>No pages published.</p>";
  }

  const listItems = pages
    .map((page) => `      <li><a href="${escapeHtml(page.url)}">${escapeHtml(page.title)}</a></li>`)
    .join("\n");

  return `<ul>\n${listItems}\n    </ul>`;
}

function renderIndexSections(pages) {
  const grouped = groupPagesByFolder(pages);
  const sections = [];

  if (grouped.size === 0) {
    sections.push(
      "    <section>\n      <h2>Pages</h2>\n      <p>No pages published.</p>\n    </section>",
    );
  } else {
    for (const [folder, folderPages] of grouped.entries()) {
      const sectionTitle = folder || "Pages";
      sections.push(
        `    <section>\n      <h2>${escapeHtml(sectionTitle)}</h2>\n      ${renderPageList(folderPages)}\n    </section>`,
      );
    }
  }

  return sections.join("\n");
}

function applyTemplate(template, replacements) {
  let output = template;

  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`{{${key}}}`, String(value));
  }

  return output;
}

export function renderPage(data) {
  return renderPageFromTemplate(defaultPageTemplate, data);
}

export function renderIndex(data) {
  return renderIndexFromTemplate(defaultIndexTemplate, data);
}

function renderPageFromTemplate(template, data) {
  const basePath = normalizeBasePath(data.basePath);
  const stylesheetHref = `${basePath}/style.css`;
  const faviconHref = `${basePath}/favicon.svg`;
  const indexHref = `${basePath}/`;

  return applyTemplate(template, {
    content: data.content,
    title: escapeHtml(data.title),
    basePath: escapeHtml(basePath),
    faviconHref: escapeHtml(faviconHref),
    stylesheetHref: escapeHtml(stylesheetHref),
    indexHref: escapeHtml(indexHref),
    siteTitle: escapeHtml(data.siteTitle),
  });
}

function renderIndexFromTemplate(template, data) {
  const basePath = normalizeBasePath(data.basePath);
  const stylesheetHref = `${basePath}/style.css`;
  const faviconHref = `${basePath}/favicon.svg`;
  const sections = renderIndexSections(data.pages);

  return applyTemplate(template, {
    title: escapeHtml(data.title),
    basePath: escapeHtml(basePath),
    pages: sections,
    faviconHref: escapeHtml(faviconHref),
    stylesheetHref: escapeHtml(stylesheetHref),
  });
}

export function defaultStylesheet() {
  return defaultStyles;
}

export function defaultFavicon() {
  return defaultIcon;
}

export async function resolveTemplates(vaultRoot) {
  const templatesDir = path.join(vaultRoot, "_templates");
  const pagePath = path.join(templatesDir, "page.html");
  const indexPath = path.join(templatesDir, "index.html");
  const stylePath = path.join(templatesDir, "style.css");
  const faviconPath = path.join(templatesDir, "favicon.svg");

  const pageTemplate = (await fileExists(pagePath))
    ? await readFileAsync(pagePath, "utf8")
    : defaultPageTemplate;
  const customIndexTemplate = (await fileExists(indexPath))
    ? await readFileAsync(indexPath, "utf8")
    : null;
  const customStylesheet = (await fileExists(stylePath))
    ? await readFileAsync(stylePath, "utf8")
    : null;
  const customFavicon = (await fileExists(faviconPath))
    ? await readFileAsync(faviconPath, "utf8")
    : null;

  return {
    renderPage: (data) => renderPageFromTemplate(pageTemplate, data),
    renderIndex: customIndexTemplate
      ? (data) => renderIndexFromTemplate(customIndexTemplate, data)
      : (data) => renderIndexFromTemplate(defaultIndexTemplate, data),
    stylesheet: customStylesheet ? () => customStylesheet : defaultStylesheet,
    favicon: customFavicon ? () => customFavicon : defaultFavicon,
  };
}
