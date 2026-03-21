import { access, readFile } from "node:fs/promises";
import path from "node:path";

function normalizeBasePath(basePath) {
  if (!basePath) {
    return "";
  }

  if (basePath === "/") {
    return "";
  }

  return basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
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
  const basePath = normalizeBasePath(data.basePath);
  const stylesheetHref = `${basePath}/style.css`;
  const faviconHref = `${basePath}/favicon.svg`;
  const indexHref = `${basePath}/`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(data.title)} - ${escapeHtml(data.siteTitle)}</title>
    <link rel="icon" type="image/svg+xml" href="${escapeHtml(faviconHref)}">
    <link rel="stylesheet" href="${escapeHtml(stylesheetHref)}">
  </head>
  <body>
    <main class="container">
      <nav><a href="${escapeHtml(indexHref)}">Home</a></nav>
      <article>
${data.content}
      </article>
    </main>
  </body>
</html>
`;
}

export function renderIndex(data) {
  const basePath = normalizeBasePath(data.basePath);
  const stylesheetHref = `${basePath}/style.css`;
  const faviconHref = `${basePath}/favicon.svg`;
  const sections = renderIndexSections(data.pages);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(data.title)}</title>
    <link rel="icon" type="image/svg+xml" href="${escapeHtml(faviconHref)}">
    <link rel="stylesheet" href="${escapeHtml(stylesheetHref)}">
  </head>
  <body>
    <main class="container">
      <header>
        <h1>${escapeHtml(data.title)}</h1>
      </header>
${sections}
    </main>
  </body>
</html>
`;
}

export function defaultStylesheet() {
  return `:root {
  color-scheme: light dark;
  --bg: #f8f8f6;
  --fg: #1c1c1a;
  --muted: #6b6b67;
  --line: #d6d6d2;
  --accent: #1a5fb4;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.65;
}

.container {
  width: min(100%, 70ch);
  margin: 0 auto;
  padding: 1.25rem;
}

nav {
  margin-bottom: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--line);
}

a {
  color: var(--accent);
}

h1,
h2,
h3 {
  line-height: 1.2;
  margin-top: 1.3em;
}

p {
  margin: 0.8em 0;
}

ul {
  padding-left: 1.25rem;
}

.dead-link {
  color: var(--muted);
  text-decoration: none;
  opacity: 0.8;
}

@media (max-width: 720px) {
  .container {
    padding: 1rem;
  }
}

@media (prefers-color-scheme: dark) {
  :root {
    --bg: #111312;
    --fg: #eceeec;
    --muted: #9ea3a0;
    --line: #2b302d;
    --accent: #8fb8ff;
  }
}
`;
}

export function defaultFavicon() {
  return `<svg width="800px" height="800px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    #Vector {
      stroke: #6b7280;
      fill: #6b7280;
    }

    @media (prefers-color-scheme: dark) {
      #Vector {
        stroke: #d1d5db;
        fill: #d1d5db;
      }
    }
  </style>
  <g id="Interface / Book_Open">
    <path id="Vector" d="M12 9.7998V19.9998M12 9.7998C12 8.11965 12 7.27992 12.327 6.63818C12.6146 6.0737 13.0732 5.6146 13.6377 5.32698C14.2794 5 15.1196 5 16.7998 5H19.3998C19.9599 5 20.2401 5 20.454 5.10899C20.6422 5.20487 20.7948 5.35774 20.8906 5.5459C20.9996 5.75981 21 6.04004 21 6.6001V15.4001C21 15.9601 20.9996 16.2398 20.8906 16.4537C20.7948 16.6419 20.6425 16.7952 20.4543 16.8911C20.2406 17 19.961 17 19.402 17H16.5693C15.6301 17 15.1597 17 14.7334 17.1295C14.356 17.2441 14.0057 17.4317 13.701 17.6821C13.3568 17.965 13.096 18.3557 12.575 19.1372L12 19.9998M12 9.7998C12 8.11965 11.9998 7.27992 11.6729 6.63818C11.3852 6.0737 10.9263 5.6146 10.3618 5.32698C9.72004 5 8.87977 5 7.19961 5H4.59961C4.03956 5 3.75981 5 3.5459 5.10899C3.35774 5.20487 3.20487 5.35774 3.10899 5.5459C3 5.75981 3 6.04004 3 6.6001V15.4001C3 15.9601 3 16.2398 3.10899 16.4537C3.20487 16.6419 3.35774 16.7952 3.5459 16.8911C3.7596 17 4.03901 17 4.59797 17H7.43073C8.36994 17 8.83942 17 9.26569 17.1295C9.64306 17.2441 9.99512 17.4317 10.2998 17.6821C10.6426 17.9638 10.9017 18.3526 11.4185 19.1277L12 19.9998" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
`;
}

export async function resolveTemplates(vaultRoot) {
  const templatesDir = path.join(vaultRoot, "_templates");
  const pagePath = path.join(templatesDir, "page.html");
  const indexPath = path.join(templatesDir, "index.html");
  const stylePath = path.join(templatesDir, "style.css");
  const faviconPath = path.join(templatesDir, "favicon.svg");

  if (!(await fileExists(pagePath))) {
    return {
      renderPage,
      renderIndex,
      stylesheet: defaultStylesheet,
      favicon: defaultFavicon,
    };
  }

  const pageTemplate = await readFile(pagePath, "utf8");
  const customIndexTemplate = (await fileExists(indexPath))
    ? await readFile(indexPath, "utf8")
    : null;
  const customStylesheet = (await fileExists(stylePath)) ? await readFile(stylePath, "utf8") : null;
  const customFavicon = (await fileExists(faviconPath))
    ? await readFile(faviconPath, "utf8")
    : null;

  return {
    renderPage: (data) => {
      const basePath = normalizeBasePath(data.basePath);
      const faviconHref = `${basePath}/favicon.svg`;

      return applyTemplate(pageTemplate, {
        content: data.content,
        title: data.title,
        basePath,
        faviconHref,
        siteTitle: data.siteTitle,
      });
    },
    renderIndex: customIndexTemplate
      ? (data) => {
          const basePath = normalizeBasePath(data.basePath);
          const faviconHref = `${basePath}/favicon.svg`;

          return applyTemplate(customIndexTemplate, {
            title: data.title,
            basePath,
            faviconHref,
            pages: renderIndexSections(data.pages),
          });
        }
      : renderIndex,
    stylesheet: customStylesheet ? () => customStylesheet : defaultStylesheet,
    favicon: customFavicon ? () => customFavicon : defaultFavicon,
  };
}
