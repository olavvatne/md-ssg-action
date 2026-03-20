import { unified } from "unified";
import { visit } from "unist-util-visit";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { remarkWikiLinks } from "./wikilinks.js";

function collectText(node) {
  if (!node || typeof node !== "object") {
    return "";
  }

  if (node.type === "text" && typeof node.value === "string") {
    return node.value;
  }

  if (!Array.isArray(node.children)) {
    return "";
  }

  return node.children.map((child) => collectText(child)).join("");
}

function remarkExtractTitle() {
  return (tree, file) => {
    let title = null;

    visit(tree, "heading", (node) => {
      if (title !== null || node.depth !== 1) {
        return;
      }

      const text = collectText(node).trim();
      if (text) {
        title = text;
      }
    });

    file.data.title = title;
  };
}

export function createProcessor(wikiLinkOptions) {
  return unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkWikiLinks, wikiLinkOptions)
    .use(remarkExtractTitle)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true });
}

export async function renderFile(processor, content) {
  const result = await processor.process(content);
  return {
    html: String(result),
    title: result.data.title ?? null,
  };
}
