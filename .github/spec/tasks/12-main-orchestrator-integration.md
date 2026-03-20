# Task 12 — Main Orchestrator & Integration Test

## Goal

Complete `src/main.js` to wire all modules together, and write an integration test that verifies the full pipeline end-to-end.

## Scope

### `src/main.js` — Complete Implementation

```js
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
      vaultRoot, files: published, images, patternMap,
    });

    await build({
      config, stagedFiles, images, stagingDir, outputDir, vaultRoot,
    });

    deps.core.info(`Site generated at ${outputDir}`);
  } catch (error) {
    deps.core.setFailed(error.message);
  }
}
```

### Integration Test

**Setup**: Create a mock vault in a temp directory:
```
vault/
├── .md-ssg.yml           # include: ["Notes/**"], tag: "publish"
├── Notes/
│   ├── Published.md      # has #publish, links to Other, has image
│   ├── Other.md          # has #publish, linked from Published
│   ├── Secret.md         # no #publish tag
│   └── images/
│       └── diagram.png
├── Private/
│   └── Journal.md        # has #publish but outside glob
```

**Assertions**:
- `_site/Published/index.html` exists, contains rendered content.
- `_site/Other/index.html` exists.
- `_site/Secret/` does **not** exist (no tag).
- `_site/Journal/` does **not** exist (outside glob, despite having tag).
- `_site/index.html` exists, lists Published and Other.
- `_site/style.css` exists.
- `_site/images/diagram.png` exists.
- Wiki-link from Published → Other is a working `<a>` link.
- Wiki-link from Published → Secret is a `<span class="dead-link">`.
- No YAML frontmatter visible in HTML output.

### Template Override Integration Test (optional)

Same setup but with `_templates/page.html` containing custom layout with `{{content}}`, `{{title}}`, `{{basePath}}` placeholders. Verify output uses custom template.

## Acceptance Criteria

- [ ] `src/main.js` correctly wires all modules in sequence
- [ ] `run(deps)` accepts injected `core`/`github` for testing
- [ ] Errors caught and reported via `deps.core.setFailed()`
- [ ] Progress logged via `deps.core.info()`
- [ ] Integration test creates realistic vault and verifies full pipeline
- [ ] Published files appear in output
- [ ] Unpublished files (no tag or outside glob) do not appear
- [ ] Wiki-links, images, index, and stylesheet all correct
- [ ] `npm run build` produces working `dist/index.js`

## Spec References

- §4.10 (main.js orchestrator)
- §9.3 (Integration Test)
- §8 (Error Handling Strategy)
- §10 (Build & Distribution)
