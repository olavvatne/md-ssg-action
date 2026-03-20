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

function renderPageList(pages) {
  if (pages.length === 0) {
    return "<p>No pages published.</p>";
  }

  const listItems = pages
    .map((page) => `      <li><a href="${escapeHtml(page.url)}">${escapeHtml(page.title)}</a></li>`)
    .join("\n");

  return `<ul>\n${listItems}\n    </ul>`;
}

export function renderPage(data) {
  const basePath = normalizeBasePath(data.basePath);
  const stylesheetHref = `${basePath}/style.css`;
  const indexHref = `${basePath}/`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(data.title)} - ${escapeHtml(data.siteTitle)}</title>
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
  const grouped = groupPagesByFolder(data.pages);

  const sections = [];

  if (grouped.size === 0) {
    sections.push(
      "    <section>\n      <h2>Pages</h2>\n      <p>No pages published.</p>\n    </section>",
    );
  } else {
    for (const [folder, pages] of grouped.entries()) {
      const sectionTitle = folder || "Pages";
      sections.push(
        `    <section>\n      <h2>${escapeHtml(sectionTitle)}</h2>\n      ${renderPageList(pages)}\n    </section>`,
      );
    }
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(data.title)}</title>
    <link rel="stylesheet" href="${escapeHtml(stylesheetHref)}">
  </head>
  <body>
    <main class="container">
      <header>
        <h1>${escapeHtml(data.title)}</h1>
      </header>
${sections.join("\n")}
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
