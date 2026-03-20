import { readFile } from "node:fs/promises";
import path from "node:path";
import yaml from "js-yaml";

const INCLUDE_ERROR = ".md-ssg.yml: 'include' must be a non-empty array of glob patterns";
const TAG_ERROR = ".md-ssg.yml: 'tag' must contain only word characters";
const BASE_PATH_ERROR = ".md-ssg.yml: 'base-path' must start with '/'";

export async function parseConfig(vaultRoot, deps) {
  const resolvedDeps = deps ?? { github: await import("@actions/github") };
  const configPath = path.join(vaultRoot, ".md-ssg.yml");

  let rawConfig;
  try {
    rawConfig = await readFile(configPath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`Missing .md-ssg.yml in vault root: ${configPath}`);
    }
    throw error;
  }

  let parsed;
  try {
    parsed = yaml.load(rawConfig);
  } catch (error) {
    throw new Error(`Invalid YAML in .md-ssg.yml: ${error.message}`);
  }

  const config = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  const include = config.include;

  if (
    !Array.isArray(include) ||
    include.length === 0 ||
    include.some((item) => typeof item !== "string")
  ) {
    throw new Error(INCLUDE_ERROR);
  }

  const tag = config.tag ?? "publish";
  if (typeof tag !== "string" || tag.length === 0 || !/^[A-Za-z0-9_-]+$/.test(tag)) {
    throw new Error(TAG_ERROR);
  }

  const repoName = resolvedDeps?.github?.context?.repo?.repo ?? "";
  const title = config.title ?? repoName;
  const basePath = config["base-path"] ?? `/${repoName}`;

  if (
    typeof basePath !== "string" ||
    !basePath.startsWith("/") ||
    (basePath !== "/" && basePath.endsWith("/"))
  ) {
    throw new Error(BASE_PATH_ERROR);
  }

  return {
    include,
    tag,
    title,
    basePath,
  };
}
