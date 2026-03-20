import { visit } from "unist-util-visit";

const WIKILINK_REGEX = /(?<!\[)\[\[([^\[\]]+?)\]\](?!\])/g;

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseWikiLink(content) {
  const [rawTarget, ...displayParts] = content.split("|");
  const target = rawTarget.trim();

  if (!target) {
    return null;
  }

  const display = displayParts.length > 0 ? displayParts.join("|").trim() : target;
  const key = target.toLowerCase();

  return { key, display: display || target };
}

function replacementNode(parsedLink, publishedFiles) {
  const url = publishedFiles.get(parsedLink.key);

  if (url) {
    return {
      type: "html",
      value: `<a href="${escapeHtml(url)}">${escapeHtml(parsedLink.display)}</a>`,
    };
  }

  return {
    type: "html",
    value: `<span class="dead-link">${escapeHtml(parsedLink.display)}</span>`,
  };
}

function splitTextNode(node, publishedFiles) {
  const content = node.value;
  const parts = [];
  let cursor = 0;
  let hasReplacement = false;

  for (const match of content.matchAll(WIKILINK_REGEX)) {
    const fullMatch = match[0];
    const inner = match[1];
    const start = match.index;

    if (start > cursor) {
      parts.push({ type: "text", value: content.slice(cursor, start) });
    }

    const parsedLink = parseWikiLink(inner);
    if (!parsedLink) {
      parts.push({ type: "text", value: fullMatch });
    } else {
      parts.push(replacementNode(parsedLink, publishedFiles));
      hasReplacement = true;
    }

    cursor = start + fullMatch.length;
  }

  if (cursor < content.length) {
    parts.push({ type: "text", value: content.slice(cursor) });
  }

  if (!hasReplacement) {
    return null;
  }

  return parts.filter((part) => part.value !== "");
}

export function remarkWikiLinks(options) {
  const { publishedFiles } = options;

  return (tree) => {
    visit(tree, "text", (node, index, parent) => {
      if (!parent || typeof index !== "number") {
        return;
      }

      const replacement = splitTextNode(node, publishedFiles);
      if (!replacement) {
        return;
      }

      parent.children.splice(index, 1, ...replacement);
    });
  };
}
