import * as core from "@actions/core";
import * as github from "@actions/github";
import { parseConfig } from "./config.js";
import { globFilter, tagFilter } from "./filter.js";
import { extractImages } from "./assets.js";
import { stageFiles } from "./staging.js";
import { build } from "./build.js";

export async function run(deps = { core, github }) {
  try {
    const vaultRoot = deps.core.getInput("markdown-location") || ".";
    const outputDir = deps.core.getInput("site-location") || "_site";

    const config = await parseConfig(vaultRoot, { github: deps.github });

    const { files: globbed, patternMap } = await globFilter(vaultRoot, config.include);
    deps.core.info(`Glob matched ${globbed.length} files`);

    const published = await tagFilter(vaultRoot, globbed, config.tag);
    deps.core.info(`Tag filter: ${published.length} files have #${config.tag}`);

    if (published.length === 0) {
      deps.core.warning("No files matched both glob and tag filters. Site will be empty.");
    }

    const images = await extractImages(vaultRoot, published);
    deps.core.info(`Found ${images.length} image references`);

    const { stagingDir, stagedFiles } = await stageFiles({
      vaultRoot,
      files: published,
      images,
      patternMap,
    });

    await build({
      config,
      stagedFiles,
      images,
      stagingDir,
      outputDir,
      vaultRoot,
    });

    deps.core.info(`Site generated at ${outputDir}`);
  } catch (error) {
    deps.core.setFailed(error.message);
  }
}
