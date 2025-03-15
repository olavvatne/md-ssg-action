import * as core from "@actions/core";

export async function run() {
  try {
    core.info("md-ssg starting");

    const markdownLocation = core.getInput("markdown-location");
    const siteLocation = core.getInput("site-location");

    core.debug(`markdown-location: ${markdownLocation}`);
    core.debug(`site-location: ${siteLocation}`);
  } catch (error) {
    core.setFailed(error.message);
  }
}
